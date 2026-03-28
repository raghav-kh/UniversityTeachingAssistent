import json
import logging
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field

from db import get_connection
from services.integrity_analyzer import analyze_session
from services.viva_generator import generate_viva_questions, evaluate_viva_response

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

router = APIRouter(prefix="/integrity", tags=["Integrity"])


# -------------------------
# Pydantic models
# -------------------------
class EditorEvent(BaseModel):
    student_id: str
    assignment_id: int
    session_id: str
    event_type: str  # 'keystroke','paste','focus_loss','delete','idle'
    event_data: Dict[str, Any] = Field(default_factory=dict)
    timestamp: str  # ISO string from frontend


class EventBatch(BaseModel):
    events: List[EditorEvent]


class AnalyzeRequest(BaseModel):
    student_id: str
    assignment_id: int
    submission_id: int
    session_id: str
    answer_text: str


class VivaResponse(BaseModel):
    question_index: int
    response_text: str
    original_answer: str


# -------------------------
# LOG EVENTS
# POST /integrity/events
# -------------------------
@router.post("/events")
def log_events(batch: EventBatch):
    """
    Frontend sends events in batches every few seconds.
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        for event in batch.events:
            cur.execute(
                """
                INSERT INTO integrity_events
                    (student_id, assignment_id, session_id,
                     event_type, event_data, timestamp)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    event.student_id,
                    event.assignment_id,
                    event.session_id,
                    event.event_type,
                    json.dumps(event.event_data),
                    event.timestamp,
                ),
            )
        conn.commit()
        return {"logged": len(batch.events)}
    except Exception as exc:
        logger.exception("Failed to log events")
        try:
            conn.rollback()
        except Exception:
            logger.exception("Rollback failed while logging events")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to log events")
    finally:
        try:
            cur.close()
        except Exception:
            logger.debug("cursor close failed")
        try:
            conn.close()
        except Exception:
            logger.debug("connection close failed")


# -------------------------
# ANALYZE SESSION
# POST /integrity/analyze
# -------------------------
@router.post("/analyze")
def analyze_submission(req: AnalyzeRequest):
    conn = get_connection()
    cur = conn.cursor()
    try:
        # 1. fetch events for this session
        cur.execute(
            """
            SELECT event_type, event_data, timestamp
            FROM integrity_events
            WHERE session_id = %s AND student_id = %s
            ORDER BY timestamp ASC
            """,
            (req.session_id, req.student_id),
        )
        raw_events = cur.fetchall()

        # normalize events for analyzer
        events: List[Dict[str, Any]] = []
        for e in raw_events:
            # event_data may already be a dict or a JSON string
            data = e.get("event_data") or {}
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except Exception:
                    data = {}
            ts = e.get("timestamp")
            # ensure ISO string
            ts_iso = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
            events.append({"event_type": e.get("event_type"), "event_data": data, "timestamp": ts_iso})

        # 2. run behavioral analysis
        report = analyze_session(events, req.answer_text)

        # 3. save integrity report
        cur.execute(
            """
            INSERT INTO integrity_reports (
                submission_id, student_id, assignment_id, session_id,
                risk_score, risk_level, total_time_secs,
                paste_count, paste_char_total, keystroke_count,
                focus_loss_count, revision_count, flags, viva_triggered
            )
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id
            """,
            (
                req.submission_id,
                req.student_id,
                req.assignment_id,
                req.session_id,
                report.get("risk_score"),
                report.get("risk_level"),
                report.get("total_time_secs"),
                report.get("paste_count"),
                report.get("paste_char_total"),
                report.get("keystroke_count"),
                report.get("focus_loss_count"),
                report.get("revision_count"),
                json.dumps(report.get("flags", [])),
                report.get("viva_triggered", False),
            ),
        )
        report_row = cur.fetchone()
        if not report_row or "id" not in report_row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to persist integrity report")
        report_id = report_row["id"]

        # 4. if viva triggered → generate questions + create viva record
        viva_id: Optional[int] = None
        viva_questions: List[Dict[str, Any]] = []

        if report.get("viva_triggered"):
            # fetch assignment title for context
            cur.execute("SELECT title FROM assignments WHERE id = %s", (req.assignment_id,))
            assignment = cur.fetchone()
            title = assignment["title"] if assignment and "title" in assignment else "Assignment"

            viva_questions = generate_viva_questions(assignment_title=title, student_answer=req.answer_text, flags=report.get("flags", []))

            # ensure questions is a JSON-serializable list
            try:
                questions_json = json.dumps(viva_questions)
            except Exception:
                questions_json = json.dumps([])

            cur.execute(
                """
                INSERT INTO vivas
                    (report_id, student_id, assignment_id, questions, status)
                VALUES (%s, %s, %s, %s, 'pending')
                RETURNING id
                """,
                (report_id, req.student_id, req.assignment_id, questions_json),
            )
            viva_row = cur.fetchone()
            if viva_row and "id" in viva_row:
                viva_id = viva_row["id"]
            logger.info("Viva created id=%s for report=%s", viva_id, report_id)

        conn.commit()

        return {
            "risk_score": report.get("risk_score"),
            "risk_level": report.get("risk_level"),
            "flags": report.get("flags", []),
            "session_stats": {
                "total_time_secs": report.get("total_time_secs"),
                "paste_count": report.get("paste_count"),
                "keystroke_count": report.get("keystroke_count"),
                "focus_loss_count": report.get("focus_loss_count"),
                "revision_count": report.get("revision_count"),
            },
            "viva_triggered": report.get("viva_triggered", False),
            "viva_id": viva_id,
            "viva_questions": viva_questions if report.get("viva_triggered") else [],
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("analyze_submission failed")
        try:
            conn.rollback()
        except Exception:
            logger.exception("rollback failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Analysis failed")
    finally:
        try:
            cur.close()
        except Exception:
            logger.debug("cursor close failed")
        try:
            conn.close()
        except Exception:
            logger.debug("connection close failed")


# -------------------------
# SUBMIT VIVA RESPONSE
# POST /integrity/viva/{viva_id}/respond
# -------------------------
@router.post("/viva/{viva_id}/respond")
def submit_viva_response(viva_id: int, resp: VivaResponse):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT questions, responses, status FROM vivas WHERE id = %s", (viva_id,))
        viva = cur.fetchone()
        if not viva:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Viva not found")

        status_val = viva.get("status")
        if status_val == "completed":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Viva already completed")

        # normalize questions/responses
        questions = viva.get("questions") or []
        if isinstance(questions, str):
            try:
                questions = json.loads(questions)
            except Exception:
                questions = []

        responses = viva.get("responses") or []
        if isinstance(responses, str):
            try:
                responses = json.loads(responses)
            except Exception:
                responses = []

        if resp.question_index < 0 or resp.question_index >= len(questions):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid question index")

        # evaluate response
        question_text = questions[resp.question_index].get("question") if isinstance(questions[resp.question_index], dict) else str(questions[resp.question_index])
        evaluation = evaluate_viva_response(question=question_text, student_response=resp.response_text, original_answer=resp.original_answer)

        # append response + evaluation
        responses.append({
            "question_index": resp.question_index,
            "question": question_text,
            "response": resp.response_text,
            "evaluation": evaluation
        })

        # check completion
        is_complete = len(responses) >= len(questions) and len(questions) > 0

        # compute viva_score normalized 0-1 if complete
        viva_score: Optional[float] = None
        if is_complete:
            scores = []
            for r in responses:
                s = r.get("evaluation", {}).get("score")
                try:
                    s = float(s)
                except Exception:
                    s = 5.0
                scores.append(max(0.0, min(10.0, s)))
            if scores:
                avg_score_0_10 = sum(scores) / len(scores)
                viva_score = round(avg_score_0_10 / 10.0, 3)

        cur.execute(
            """
            UPDATE vivas
            SET responses = %s,
                status = %s,
                viva_score = %s,
                completed_at = CASE WHEN %s THEN NOW() ELSE NULL END
            WHERE id = %s
            """,
            (
                json.dumps(responses),
                "completed" if is_complete else "active",
                viva_score,
                is_complete,
                viva_id,
            ),
        )

        conn.commit()

        return {
            "response_saved": True,
            "evaluation": evaluation,
            "viva_complete": is_complete,
            "viva_score": viva_score,
            "questions_remaining": max(0, len(questions) - len(responses))
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("submit_viva_response failed")
        try:
            conn.rollback()
        except Exception:
            logger.exception("rollback failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to submit viva response")
    finally:
        try:
            cur.close()
        except Exception:
            logger.debug("cursor close failed")
        try:
            conn.close()
        except Exception:
            logger.debug("connection close failed")


# -------------------------
# GET ALL INTEGRITY REPORTS (professor view)
# GET /integrity/reports
# -------------------------
@router.get("/reports")
def get_reports(risk_level: Optional[str] = None):
    conn = get_connection()
    cur = conn.cursor()
    try:
        base_query = """
            SELECT
                ir.id, ir.student_id, ir.risk_score, ir.risk_level,
                ir.total_time_secs, ir.paste_count, ir.keystroke_count,
                ir.focus_loss_count, ir.revision_count, ir.viva_triggered,
                ir.flags, ir.created_at,
                a.title as assignment_title,
                v.status as viva_status,
                v.viva_score
            FROM integrity_reports ir
            JOIN assignments a ON ir.assignment_id = a.id
            LEFT JOIN vivas v ON v.report_id = ir.id
        """
        if risk_level:
            cur.execute(base_query + " WHERE ir.risk_level = %s ORDER BY ir.risk_score DESC", (risk_level,))
        else:
            cur.execute(base_query + " ORDER BY ir.risk_score DESC")
        rows = cur.fetchall()
        reports = [dict(r) for r in rows]
        return {"count": len(reports), "reports": reports}
    except Exception as exc:
        logger.exception("get_reports failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch reports")
    finally:
        try:
            cur.close()
        except Exception:
            logger.debug("cursor close failed")
        try:
            conn.close()
        except Exception:
            logger.debug("connection close failed")


@router.get("/viva/{viva_id}")
def get_viva(viva_id: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM vivas WHERE id = %s", (viva_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Viva not found")
        return {
            "id": row["id"],
            "status": row["status"],
            "questions": row["questions"] if isinstance(row["questions"], list) else json.loads(row["questions"]),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        try:
            cur.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass