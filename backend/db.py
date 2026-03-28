import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import logging

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_connection():
    """Create a new PostgreSQL connection."""
    postgres_url = os.getenv("POSTGRES_URL")
    if not postgres_url:
        raise ValueError("POSTGRES_URL environment variable is not set")
    return psycopg2.connect(postgres_url, cursor_factory=RealDictCursor)

def init_db():
    """
    Run once on startup.
    Creates the pgvector extension and all tables.
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                # Enable pgvector extension
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

                # Courses table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS courses (
                        id          SERIAL PRIMARY KEY,
                        name        TEXT NOT NULL,
                        subject     TEXT NOT NULL,
                        created_at  TIMESTAMP DEFAULT NOW()
                    );
                """)

                # Documents table
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

                # Document chunks table
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

                # Index for fast similarity search
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS chunks_embedding_idx
                    ON document_chunks
                    USING ivfflat (embedding vector_cosine_ops)
                    WITH (lists = 100);
                """)

                # Assignments table
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

                # Submissions table
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

                # Grades table
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

                # Review queue
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

                logger.info("✅ Grading tables initialized")

                # Integrity events
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

                # Integrity reports
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

                # Vivas
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

                logger.info("✅ Integrity tables initialized")

        logger.info("✅ Database schema initialized")

    except Exception as e:
        logger.error(f"❌ Error initializing database: {e}")
        raise