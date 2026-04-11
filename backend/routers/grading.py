import io
import json
import logging
import os
import shutil
from typing import List, Dict, Any, Optional

import pytesseract
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from PIL import Image
from pydantic import BaseModel

from db import get_connection
from services.llm_router import route_and_grade, CONFIDENCE_THRESHOLD

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

router = APIRouter(prefix="/grading", tags=["Grading"])


def _tesseract_executable() -> Optional[str]:
    return os.getenv("TESSERACT_CMD") or shutil.which("tesseract")


@router.post("/submit-scan")
def submit_scan(
    assignment_id: int = Form(...),
    student_name: str = Form(...),
    student_id: str = Form(...),
    image: UploadFile = File(...),
):
    """OCR an uploaded handwritten image, then run through grading pipeline."""
    tess = _tesseract_executable()
    if not tess:
        raise HTTPException(
            status_code=503,
            detail="OCR is not configured (set TESSERACT_CMD or install tesseract). On Vercel use a hosted OCR API or skip scan uploads.",
        )
    pytesseract.pytesseract.tesseract_cmd = tess

    # 1. Read image bytes synchronously
    contents = image.file.read()
    pil_image = Image.open(io.BytesIO(contents))

    # 2. OCR
    try:
        answer_text = pytesseract.image_to_string(pil_image).strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {e}")

    if not answer_text:
        raise HTTPException(status_code=422, detail="Could not extract text from image")

    conn = get_connection()
    cur = conn.cursor()
    try:
        # 3. Fetch assignment
        cur.execute("SELECT * FROM assignments WHERE id = %s", (assignment_id,))
        assignment = cur.fetchone()
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")

        # 4. Save submission
        cur.execute(
            """
            INSERT INTO submissions (assignment_id, student_name, student_id, answer_text)
            VALUES (%s, %s, %s, %s) RETURNING id
            """,
            (assignment_id, student_name, student_id, answer_text),
        )
        submission_id = cur.fetchone()["id"]

        # 5. Grade via existing LLM router
        grading_result = route_and_grade(
            task_type=assignment["type"],
            question=assignment["title"],
            student_answer=answer_text,
            correct_answer=assignment.get("description") or "",
            rubric=assignment.get("rubric") or "",
            max_marks=assignment["max_marks"],
        )

        # 6. Save grade
        cur.execute(
            """
            INSERT INTO grades
                (submission_id, score, max_score, confidence, model_used,
                 tier, feedback, rubric_matches, flagged, flag_reason)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, score, max_score, confidence, feedback, flagged
            """,
            (
                submission_id,
                grading_result["score"],
                assignment["max_marks"],
                grading_result["confidence"],
                grading_result.get("model_used"),
                grading_result.get("tier"),
                grading_result.get("feedback"),
                json.dumps({
                    "matched": grading_result.get("matched_concepts", []),
                    "missing": grading_result.get("missing_concepts", []),
                }),
                grading_result.get("flagged", False),
                grading_result.get("flag_reason"),
            ),
        )
        grade_row = dict(cur.fetchone())

        # 7. Enqueue for review if flagged
        if grading_result.get("flagged"):
            priority = "urgent" if grading_result.get("confidence", 1) < 0.65 else "normal"
            cur.execute(
                """
                INSERT INTO review_queue (grade_id, submission_id, reason, priority)
                VALUES (%s, %s, %s, %s)
                """,
                (grade_row["id"], submission_id, grading_result.get("flag_reason"), priority),
            )

        conn.commit()
        return {
            "submission_id": submission_id,
            "ocr_text": answer_text,
            "grade": grade_row,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("submit_scan failed")
        try:
            conn.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Scan grading failed: {exc}")
    finally:
        try:
            cur.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass


# -------------------------
# Pydantic models
# -------------------------
class SubmissionRequest(BaseModel):
    assignment_id: int
    student_name: str
    student_id: str
    answer_text: str


class SubmissionResponse(BaseModel):
    submission_id: int
    grade_id: int
    score: float
    max_score: int
    percentage: float
    confidence: float
    tier_used: Optional[int]
    model_used: Optional[str]
    feedback: Optional[str]
    matched_concepts: List[Any]
    missing_concepts: List[Any]
    flagged: bool
    flag_reason: Optional[str]
    escalated: bool = False


class ReviewDecision(BaseModel):
    action: str
    new_score: Optional[float] = None
    professor_feedback: Optional[str] = None


class ReviewQueueItem(BaseModel):
    queue_id: int
    priority: str
    reason: Optional[str]
    created_at: Optional[str]
    student_name: Optional[str]
    student_id: Optional[str]
    answer_text: Optional[str]
    assignment_title: Optional[str]
    assignment_type: Optional[str]
    score: Optional[float]
    max_score: Optional[int]
    confidence: Optional[float]
    feedback: Optional[str]
    model_used: Optional[str]
    grade_id: Optional[int]


# -------------------------
# Submit + Auto-grade
# POST /grading/submit
# -------------------------
@router.post("/submit", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
def submit_and_grade(req: SubmissionRequest):
    conn = get_connection()
    cur = conn.cursor()
    try:
        # Fetch assignment
        cur.execute(
            """
            SELECT id, title, type, rubric, max_marks,
                   description as correct_answer_hint
            FROM assignments WHERE id = %s
            """,
            (req.assignment_id,),
        )
        assignment = cur.fetchone()
        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

        # Insert submission
        cur.execute(
            """
            INSERT INTO submissions
                (assignment_id, student_name, student_id, answer_text)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            (req.assignment_id, req.student_name, req.student_id, req.answer_text),
        )
        submission_row = cur.fetchone()
        if not submission_row or "id" not in submission_row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create submission")
        submission_id = submission_row["id"]

        # Grade via LLM router
        grading_result = route_and_grade(
            task_type=assignment["type"],
            question=assignment["title"],
            student_answer=req.answer_text,
            correct_answer=assignment.get("correct_answer_hint") or "",
            rubric=assignment.get("rubric") or "",
            max_marks=assignment["max_marks"],
        )

        # Persist grade
        cur.execute(
            """
            INSERT INTO grades (
                submission_id, score, max_score, confidence,
                model_used, tier, feedback, rubric_matches,
                flagged, flag_reason
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                submission_id,
                grading_result["score"],
                assignment["max_marks"],
                grading_result["confidence"],
                grading_result.get("model_used"),
                grading_result.get("tier"),
                grading_result.get("feedback"),
                json.dumps(
                    {
                        "matched": grading_result.get("matched_concepts", []),
                        "missing": grading_result.get("missing_concepts", []),
                        "breakdown": grading_result.get("rubric_breakdown", {}),
                    }
                ),
                grading_result.get("flagged", False),
                grading_result.get("flag_reason"),
            ),
        )
        grade_row = cur.fetchone()
        if not grade_row or "id" not in grade_row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to persist grade")
        grade_id = grade_row["id"]

        # Enqueue for review if flagged
        if grading_result.get("flagged"):
            priority = "urgent" if grading_result.get("confidence", 0) < 0.65 else "normal"
            cur.execute(
                """
                INSERT INTO review_queue
                    (grade_id, submission_id, reason, priority)
                VALUES (%s, %s, %s, %s)
                """,
                (grade_id, submission_id, grading_result.get("flag_reason"), priority),
            )

        conn.commit()

        max_marks = assignment["max_marks"] or 1
        percentage = round((grading_result["score"] / max_marks) * 100, 1) if max_marks else 0.0

        return {
            "submission_id": submission_id,
            "grade_id": grade_id,
            "score": grading_result["score"],
            "max_score": max_marks,
            "percentage": percentage,
            "confidence": grading_result["confidence"],
            "tier_used": grading_result.get("tier"),
            "model_used": grading_result.get("model_used"),
            "feedback": grading_result.get("feedback", ""),
            "matched_concepts": grading_result.get("matched_concepts", []),
            "missing_concepts": grading_result.get("missing_concepts", []),
            "flagged": grading_result.get("flagged", False),
            "flag_reason": grading_result.get("flag_reason"),
            "escalated": grading_result.get("escalated", False),
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("submit_and_grade failed")
        try:
            conn.rollback()
        except Exception:
            logger.exception("rollback failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Grading failed: {exc}")
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
# GET REVIEW QUEUE
# GET /grading/review-queue
# -------------------------
@router.get("/review-queue")
def get_review_queue(resolved: bool = False):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                rq.id as queue_id,
                rq.priority,
                rq.reason,
                rq.created_at,
                s.student_name,
                s.student_id,
                s.answer_text,
                a.title as assignment_title,
                a.type as assignment_type,
                g.score,
                g.max_score,
                g.confidence,
                g.feedback,
                g.model_used,
                g.id as grade_id
            FROM review_queue rq
            JOIN grades g ON rq.grade_id = g.id
            JOIN submissions s ON rq.submission_id = s.id
            JOIN assignments a ON s.assignment_id = a.id
            WHERE rq.resolved = %s
            ORDER BY
                CASE rq.priority WHEN 'urgent' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                rq.created_at DESC
            """,
            (resolved,),
        )
        items = cur.fetchall()
        queue = [dict(r) for r in items]
        return {"count": len(queue), "queue": queue}
    except Exception as exc:
        logger.exception("get_review_queue failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
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
# PROFESSOR OVERRIDE
# PATCH /grading/review/{queue_id}
# -------------------------
@router.patch("/review/{queue_id}")
def resolve_review(queue_id: int, decision: ReviewDecision):
    if decision.action not in ("approve", "override"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="action must be 'approve' or 'override'")

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT grade_id FROM review_queue WHERE id = %s", (queue_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queue item not found")

        grade_id = row["grade_id"]

        if decision.action == "override" and decision.new_score is not None:
            cur.execute(
                """
                UPDATE grades
                SET score = %s, feedback = %s,
                    reviewed_by_prof = TRUE, flagged = FALSE
                WHERE id = %s
                """,
                (decision.new_score, decision.professor_feedback, grade_id),
            )
        else:
            cur.execute(
                """
                UPDATE grades
                SET reviewed_by_prof = TRUE, flagged = FALSE
                WHERE id = %s
                """,
                (grade_id,),
            )

        cur.execute("UPDATE review_queue SET resolved = TRUE WHERE id = %s", (queue_id,))
        conn.commit()
        return {"message": f"Grade {decision.action}d successfully", "grade_id": grade_id}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("resolve_review failed")
        try:
            conn.rollback()
        except Exception:
            logger.exception("rollback failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
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
# GET GRADES FOR A STUDENT
# GET /grading/student/{student_id}
# -------------------------
@router.get("/student/{student_id}")
def get_student_grades(student_id: str):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                a.title, a.type, a.max_marks,
                g.score, g.confidence, g.feedback,
                g.tier, g.model_used, g.flagged,
                g.reviewed_by_prof, g.graded_at
            FROM grades g
            JOIN submissions s ON g.submission_id = s.id
            JOIN assignments a ON s.assignment_id = a.id
            WHERE s.student_id = %s
            ORDER BY g.graded_at DESC
            """,
            (student_id,),
        )
        rows = cur.fetchall()
        grades = [dict(r) for r in rows]
        return {"student_id": student_id, "grades": grades}
    except Exception as exc:
        logger.exception("get_student_grades failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
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
# GET STATS
# GET /grading/stats
# -------------------------
@router.get("/stats")
def get_stats():
    conn = get_connection()
    cur = conn.cursor()
    try:
        # total grades
        cur.execute("SELECT COUNT(*) as total FROM grades")
        total = cur.fetchone()["total"] or 0

        # tier breakdown
        cur.execute(
            """
            SELECT tier, COUNT(*) as count
            FROM grades
            GROUP BY tier
            ORDER BY tier
            """
        )
        tier_rows = cur.fetchall()
        tier_counts = {str(r["tier"]): r["count"] for r in tier_rows}
        t1 = tier_counts.get("1", 0)
        t2 = tier_counts.get("2", 0)

        # flagged count
        cur.execute("SELECT COUNT(*) as count FROM grades WHERE flagged = TRUE")
        flagged = cur.fetchone()["count"] or 0

        # avg confidence
        cur.execute("SELECT AVG(confidence) as avg_conf FROM grades")
        avg_conf = cur.fetchone()["avg_conf"] or 0

        # confidence distribution buckets
        cur.execute(
            """
            SELECT
                COUNT(CASE WHEN confidence >= 0.85 THEN 1 END) as high,
                COUNT(CASE WHEN confidence >= 0.65
                            AND confidence < 0.85 THEN 1 END) as medium,
                COUNT(CASE WHEN confidence < 0.65 THEN 1 END) as low
            FROM grades
            """
        )
        conf_row = cur.fetchone()
        conf_dist = {
            "high": int(conf_row["high"] or 0),
            "medium": int(conf_row["medium"] or 0),
            "low": int(conf_row["low"] or 0),
        }

        # model usage breakdown
        cur.execute(
            """
            SELECT model_used, COUNT(*) as count
            FROM grades
            GROUP BY model_used
            ORDER BY count DESC
            """
        )
        model_rows = cur.fetchall()

        # reviewed by professor
        cur.execute("SELECT COUNT(*) as count FROM grades WHERE reviewed_by_prof = TRUE")
        reviewed = cur.fetchone()["count"] or 0

        t2_cost_inr = round(t2 * 0.83, 2)
        saved_inr = round(t1 * 0.83, 2)

        return {
            "total_grades": total,
            "tier1_count": t1,
            "tier2_count": t2,
            "tier1_pct": round(t1 / max(total, 1) * 100, 1),
            "tier2_pct": round(t2 / max(total, 1) * 100, 1),
            "flagged_count": flagged,
            "flagged_pct": round(flagged / max(total, 1) * 100, 1),
            "avg_confidence": round(float(avg_conf), 3),
            "confidence_distribution": conf_dist,
            "model_usage": [dict(r) for r in model_rows],
            "reviewed_by_prof": reviewed,
            "cost_estimate": {
                "tier2_spent_inr": t2_cost_inr,
                "saved_by_tier1_inr": saved_inr,
                "total_if_all_t2_inr": round((t1 + t2) * 0.83, 2),
            },
        }
    except Exception as exc:
        logger.exception("get_stats failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
    finally:
        try:
            cur.close()
        except Exception:
            logger.debug("cursor close failed")
        try:
            conn.close()
        except Exception:
            logger.debug("connection close failed")