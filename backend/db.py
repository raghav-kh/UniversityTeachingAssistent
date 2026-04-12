import logging
import os
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _database_url() -> str:
    """
    Vercel/Neon/Supabase: use DATABASE_URL or POSTGRES_URL.
    Neon pooled: use the *-pooler* host connection string for serverless.
    """
    url = (
        os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_URL")
        or os.getenv("POSTGRES_PRISMA_URL")
        or os.getenv("NEON_DATABASE_URL")
    )
    if not url:
        raise ValueError(
            "Database URL not set. Set DATABASE_URL or POSTGRES_URL (Neon/Supabase pooled recommended)."
        )
    return url


def _ensure_ssl_query(dsn: str) -> str:
    """Append sslmode=require for managed Postgres (Neon/Supabase/Vercel); skip localhost."""
    parsed = urlparse(dsn)
    if parsed.scheme not in ("postgres", "postgresql"):
        return dsn
    host = (parsed.hostname or "").lower()
    if host in ("localhost", "127.0.0.1", "::1"):
        return dsn
    needs_ssl = (
        os.getenv("FORCE_PG_SSL", "").lower() in ("1", "true", "yes")
        or os.getenv("VERCEL") == "1"
        or "neon.tech" in host
        or "supabase.co" in host
    )
    if not needs_ssl:
        return dsn
    q = parse_qs(parsed.query)
    
    # Remove unsupported query parameters for psycopg2 (like Supabase telemetry)
    unsupported_keys = {"supa", "pgbouncer", "pooler"}
    for key in list(q.keys()):
        if key.lower() in unsupported_keys:
            del q[key]
            
    if not any(k.lower() == "sslmode" for k in q):
        q["sslmode"] = ["require"]
        
    new_query = urlencode(q, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


def get_connection():
    """One connection per request — pair with Neon pooler or PgBouncer (transaction mode)."""
    dsn = _ensure_ssl_query(_database_url())
    return psycopg2.connect(
        dsn,
        cursor_factory=RealDictCursor,
        connect_timeout=int(os.getenv("POSTGRES_CONNECT_TIMEOUT", "12")),
        options="-c statement_timeout=55000",
    )


def init_db():
    """
    Creates extensions and tables. Run once per environment (not on every cold start):
      RUN_DB_INIT=true vercel env pull && python -c "from db import init_db; init_db()"
    Or: psql $DATABASE_URL -f migrate_day9.sql
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id            SERIAL PRIMARY KEY,
                        name          TEXT NOT NULL,
                        username      TEXT NOT NULL UNIQUE,
                        password_hash TEXT NOT NULL,
                        role          TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
                        created_at    TIMESTAMPTZ DEFAULT NOW()
                    );
                """)

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS courses (
                        id          SERIAL PRIMARY KEY,
                        name        TEXT NOT NULL,
                        subject     TEXT NOT NULL,
                        created_at  TIMESTAMP DEFAULT NOW()
                    );
                """)

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS documents (
                        id          SERIAL PRIMARY KEY,
                        course_id   INTEGER REFERENCES courses(id),
                        filename    TEXT NOT NULL,
                        file_type   TEXT NOT NULL,
                        chunk_count INTEGER DEFAULT 0,
                        created_at  TIMESTAMP DEFAULT NOW()
                    );
                """)

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS document_chunks (
                        id          SERIAL PRIMARY KEY,
                        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
                        course_id   INTEGER REFERENCES courses(id),
                        chunk_index INTEGER NOT NULL,
                        content     TEXT NOT NULL,
                        embedding   vector(1536),
                        metadata    JSONB DEFAULT '{}',
                        created_at  TIMESTAMP DEFAULT NOW()
                    );
                """)

                cur.execute("""
                    CREATE INDEX IF NOT EXISTS chunks_embedding_idx
                    ON document_chunks
                    USING ivfflat (embedding vector_cosine_ops)
                    WITH (lists = 100);
                """)

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS assignments (
                        id           SERIAL PRIMARY KEY,
                        course_id    INTEGER REFERENCES courses(id),
                        title        TEXT NOT NULL,
                        description  TEXT,
                        type         TEXT NOT NULL,
                        rubric       TEXT,
                        max_marks    INTEGER DEFAULT 100,
                        created_at   TIMESTAMP DEFAULT NOW()
                    );
                """)

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS submissions (
                        id              SERIAL PRIMARY KEY,
                        assignment_id   INTEGER REFERENCES assignments(id),
                        student_name    TEXT NOT NULL,
                        student_id      TEXT NOT NULL,
                        answer_text     TEXT NOT NULL,
                        submitted_at    TIMESTAMP DEFAULT NOW()
                    );
                """)

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS grades (
                        id                SERIAL PRIMARY KEY,
                        submission_id     INTEGER REFERENCES submissions(id),
                        score             NUMERIC(5,2),
                        max_score         INTEGER,
                        confidence        NUMERIC(4,3),
                        model_used        TEXT,
                        tier              INTEGER,
                        feedback          TEXT,
                        rubric_matches    JSONB,
                        flagged           BOOLEAN DEFAULT FALSE,
                        flag_reason       TEXT,
                        reviewed_by_prof  BOOLEAN DEFAULT FALSE,
                        graded_at         TIMESTAMP DEFAULT NOW()
                    );
                """)

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS review_queue (
                        id            SERIAL PRIMARY KEY,
                        grade_id      INTEGER REFERENCES grades(id),
                        submission_id INTEGER REFERENCES submissions(id),
                        reason        TEXT,
                        priority      TEXT DEFAULT 'normal',
                        resolved      BOOLEAN DEFAULT FALSE,
                        created_at    TIMESTAMP DEFAULT NOW()
                    );
                """)

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS integrity_events (
                        id              SERIAL PRIMARY KEY,
                        submission_id   INTEGER,
                        student_id      TEXT NOT NULL,
                        assignment_id   INTEGER REFERENCES assignments(id),
                        event_type      TEXT NOT NULL,
                        event_data      JSONB,
                        session_id      TEXT NOT NULL,
                        timestamp       TIMESTAMP DEFAULT NOW()
                    );
                """)

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS integrity_reports (
                        id                  SERIAL PRIMARY KEY,
                        submission_id       INTEGER REFERENCES submissions(id),
                        student_id          TEXT NOT NULL,
                        assignment_id       INTEGER REFERENCES assignments(id),
                        session_id          TEXT NOT NULL,
                        risk_score          NUMERIC(4,3),
                        risk_level          TEXT,
                        total_time_secs     INTEGER,
                        paste_count         INTEGER DEFAULT 0,
                        paste_char_total    INTEGER DEFAULT 0,
                        keystroke_count     INTEGER DEFAULT 0,
                        focus_loss_count    INTEGER DEFAULT 0,
                        revision_count      INTEGER DEFAULT 0,
                        flags               JSONB,
                        viva_triggered      BOOLEAN DEFAULT FALSE,
                        created_at          TIMESTAMP DEFAULT NOW()
                    );
                """)

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS vivas (
                        id              SERIAL PRIMARY KEY,
                        report_id       INTEGER REFERENCES integrity_reports(id),
                        student_id      TEXT NOT NULL,
                        assignment_id   INTEGER REFERENCES assignments(id),
                        status          TEXT DEFAULT 'pending',
                        questions       JSONB,
                        responses       JSONB,
                        viva_score      NUMERIC(4,3),
                        scheduled_at    TIMESTAMP,
                        completed_at    TIMESTAMP,
                        created_at      TIMESTAMP DEFAULT NOW()
                    );
                """)

        logger.info("Database schema initialized")
    except Exception as e:
        logger.error("Error initializing database: %s", e)
        raise
