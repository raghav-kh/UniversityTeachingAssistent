from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import bcrypt
from db import get_connection

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class CreateUserRequest(BaseModel):
    name: str
    username: str
    password: str
    role: str  # "admin" | "teacher" | "student"


class UserOut(BaseModel):
    id: int
    name: str
    username: str
    role: str


@router.post("/login")
def login(req: LoginRequest):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT id, name, username, password_hash, role FROM users WHERE username = %s",
            (req.username,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        password_matches = bcrypt.checkpw(
            req.password.encode("utf-8"),
            row["password_hash"].encode("utf-8"),
        )
        if not password_matches:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return {
            "id": row["id"],
            "name": row["name"],
            "username": row["username"],
            "role": row["role"],
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


@router.post("/users", response_model=UserOut)
def create_user(req: CreateUserRequest):
    if req.role not in ("admin", "teacher", "student"):
        raise HTTPException(status_code=400, detail="Invalid role")
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM users WHERE username = %s", (req.username,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Username already taken")
        password_hash = bcrypt.hashpw(
            req.password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")
        cur.execute(
            """
            INSERT INTO users (name, username, password_hash, role)
            VALUES (%s, %s, %s, %s)
            RETURNING id, name, username, role
            """,
            (req.name, req.username, password_hash, req.role),
        )
        row = dict(cur.fetchone())
        conn.commit()
        return row
    except HTTPException:
        raise
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


@router.get("/users", response_model=list[UserOut])
def list_users():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, name, username, role FROM users ORDER BY id")
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