from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_connection

router = APIRouter(tags=["courses"])


class CreateCourseRequest(BaseModel):
    name: str
    subject: str


class CreateAssignmentRequest(BaseModel):
    course_id: int
    title: str
    description: str
    type: str
    rubric: str
    max_marks: int


@router.post("/courses")
def create_course(req: CreateCourseRequest):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO courses (name, subject) VALUES (%s, %s) RETURNING id, name, subject, created_at",
            (req.name, req.subject),
        )
        row = dict(cur.fetchone())
        conn.commit()
        return row
    except Exception as exc:
        try:
            conn.rollback()
        except Exception:
            pass
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


@router.get("/courses")
def list_courses():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, name, subject, created_at FROM courses ORDER BY created_at DESC")
        return [dict(r) for r in cur.fetchall()]
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


@router.post("/assignments")
def create_assignment(req: CreateAssignmentRequest):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO assignments (course_id, title, description, type, rubric, max_marks)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, course_id, title, description, type, rubric, max_marks, created_at
            """,
            (req.course_id, req.title, req.description, req.type, req.rubric, req.max_marks),
        )
        row = dict(cur.fetchone())
        conn.commit()
        return row
    except Exception as exc:
        try:
            conn.rollback()
        except Exception:
            pass
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


@router.get("/assignments")
def list_assignments(course_id: Optional[int] = None):
    conn = get_connection()
    cur = conn.cursor()
    try:
        if course_id:
            cur.execute(
                "SELECT * FROM assignments WHERE course_id = %s ORDER BY created_at DESC",
                (course_id,),
            )
        else:
            cur.execute("SELECT * FROM assignments ORDER BY created_at DESC")
        return [dict(r) for r in cur.fetchall()]
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


@router.get("/students/status")
def students_status():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                s.student_id,
                s.student_name,
                COUNT(s.id)                          AS total_submissions,
                ROUND(AVG(g.score)::numeric, 1)      AS avg_score,
                SUM(CASE WHEN ir.risk_level = 'HIGH' THEN 1 ELSE 0 END) AS high_risk_count,
                SUM(CASE WHEN g.reviewed_by_prof THEN 1 ELSE 0 END)     AS reviewed_count
            FROM submissions s
            LEFT JOIN grades g  ON g.submission_id = s.id
            LEFT JOIN integrity_reports ir ON ir.submission_id = s.id
            GROUP BY s.student_id, s.student_name
            ORDER BY s.student_name
            """
        )
        return [dict(r) for r in cur.fetchall()]
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