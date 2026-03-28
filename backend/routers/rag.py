import os
import json
import logging
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from pydantic import BaseModel, Field

from db import get_connection
from services.document_processor import extract_text_from_pdf, chunk_text
from services.embeddings import get_embedding

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

router = APIRouter(prefix="/rag", tags=["RAG Engine"])


# -------------------------
# Pydantic models
# -------------------------
class UploadResponse(BaseModel):
    message: str
    document_id: int
    chunks_created: int
    filename: str


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1)
    course_id: int
    top_k: int = Field(5, ge=1, le=50)
    provider: str = Field("ollama")  # "ollama" or "openai"
    fast_mode: bool = False


class SourcePreview(BaseModel):
    content: str
    similarity: float
    filename: Optional[str]


class QueryResponse(BaseModel):
    question: str
    answer: str
    sources: List[SourcePreview]
    chunks_used: int


# -------------------------
# Upload endpoint
# POST /rag/upload
# -------------------------
@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(file: UploadFile = File(...), course_id: int = Form(...)):
    # Validate file type
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files supported right now")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    # Extract text
    try:
        raw_text = extract_text_from_pdf(file_bytes)
    except ValueError as e:
        logger.exception("PDF extraction failed")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error extracting PDF")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to extract PDF text")

    if not raw_text.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PDF appears to be empty or image-only")

    conn = get_connection()
    cur = conn.cursor()
    try:
        # Save document record
        cur.execute(
            """
            INSERT INTO documents (course_id, filename, file_type)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (course_id, file.filename, "pdf"),
        )
        row = cur.fetchone()
        if not row or "id" not in row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create document record")
        document_id = row["id"]

        # Chunk text
        chunks = list(chunk_text(raw_text))
        if not chunks:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No text chunks produced from document")

        # Embed and store chunks
        for chunk in chunks:
            try:
                embedding = get_embedding(chunk["content"])
            except Exception as e:
                logger.exception("Embedding generation failed for chunk %s", chunk.get("chunk_index"))
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Embedding failed: {e}")

            # Convert embedding to Postgres vector literal string
            embedding_str = "[" + ",".join(str(float(x)) for x in embedding) + "]"

            metadata = {
                "word_start": chunk.get("word_start"),
                "word_end": chunk.get("word_end"),
                "filename": file.filename,
            }

            cur.execute(
                """
                INSERT INTO document_chunks
                    (document_id, course_id, chunk_index, content, embedding, metadata)
                VALUES (%s, %s, %s, %s, %s::vector, %s)
                """,
                (
                    document_id,
                    course_id,
                    chunk.get("chunk_index"),
                    chunk.get("content"),
                    embedding_str,
                    json.dumps(metadata),
                ),
            )

        # Update document chunk count
        cur.execute("UPDATE documents SET chunk_count = %s WHERE id = %s", (len(chunks), document_id))
        conn.commit()

        return UploadResponse(
            message="Document processed successfully",
            document_id=document_id,
            chunks_created=len(chunks),
            filename=file.filename,
        )

    except HTTPException:
        try:
            conn.rollback()
        except Exception:
            logger.exception("Rollback failed")
        raise
    except Exception as exc:
        logger.exception("Document processing failed")
        try:
            conn.rollback()
        except Exception:
            logger.exception("Rollback failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Processing failed: {exc}")
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
# Query endpoint
# POST /rag/query
# -------------------------
@router.post("/query", response_model=QueryResponse)
async def query_rag(req: QueryRequest):
    # Validate provider
    provider = (req.provider or "ollama").lower()
    if provider not in ("ollama", "openai"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="provider must be 'ollama' or 'openai'")

    # 1. Embed the incoming question
    try:
        query_embedding = get_embedding(req.question)
    except Exception as e:
        logger.exception("Failed to embed query")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Embedding failed: {e}")

    embedding_str = "[" + ",".join(str(float(x)) for x in query_embedding) + "]"

    conn = get_connection()
    cur = conn.cursor()
    try:
        # 2. Find top_k most similar chunks using pgvector
        cur.execute(
            """
            SELECT content, metadata, 1 - (embedding <=> %s::vector) AS similarity
            FROM document_chunks
            WHERE course_id = %s
            ORDER BY embedding <=> %s::vector
            LIMIT %s
            """,
            (embedding_str, req.course_id, embedding_str, req.top_k),
        )
        rows = cur.fetchall()
        if not rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No relevant content found for this course")

        # Normalize chunk rows
        chunks = []
        for r in rows:
            metadata = r.get("metadata") or {}
            # metadata may be stored as JSON string or dict depending on driver
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except Exception:
                    metadata = {}
            chunks.append({"content": r["content"], "metadata": metadata, "similarity": float(r["similarity"])})

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error querying chunks")
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

    # 3. Build context from retrieved chunks
    context = "\n\n---\n\n".join([f"[Source: {c['metadata'].get('filename','unknown')}]\n{c['content']}" for c in chunks])

    # 4. Fast mode: return chunk previews instead of calling LLM
    if req.fast_mode:
        chunk_summaries = []
        for i, c in enumerate(chunks):
            preview = c["content"][:300].strip()
            similarity_pct = round(c["similarity"] * 100)
            filename = c["metadata"].get("filename", "document")
            chunk_summaries.append(f"[{i+1}] From {filename} ({similarity_pct}% match):\n{preview}")
        answer = "\n\n".join(chunk_summaries)
    else:
        answer = generate_grounded_answer(req.question, context, provider)

    # 5. Build sources preview
    sources = [
        SourcePreview(
            content=(c["content"][:200] + "...") if len(c["content"]) > 200 else c["content"],
            similarity=round(c["similarity"], 4),
            filename=c["metadata"].get("filename"),
        )
        for c in chunks
    ]

    return QueryResponse(question=req.question, answer=answer, sources=sources, chunks_used=len(chunks))


# -------------------------
# Grounded answer helper
# -------------------------
def generate_grounded_answer(question: str, context: str, provider: str) -> str:
    """
    Strict RAG prompt — LLM must only use provided context.
    Returns the model's answer string or raises HTTPException on failure.
    """
    # Keep context reasonably sized
    context_words = context.split()
    if len(context_words) > 1200:
        context = " ".join(context_words[:1200]) + "\n[...context truncated...]"

    prompt = (
        "You are an academic assistant for a university course.\n"
        "Answer the student's question using ONLY the context provided below.\n"
        "If the answer is not in the context, say: \"This topic is not covered in the uploaded materials.\"\n"
        "Do NOT use any outside knowledge. Be concise and clear.\n\n"
        f"CONTEXT:\n{context}\n\nQUESTION:\n{question}\n\nANSWER:"
    )

    if provider == "ollama":
        import requests

        try:
            response = requests.post(
                f"{os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')}/api/generate",
                json={
                    "model": os.getenv("OLLAMA_MODEL", "llama3.2:3b"),
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 256},
                },
                timeout=int(os.getenv("OLLAMA_TIMEOUT_SECONDS", 120)),
            )
            response.raise_for_status()
            data = response.json()
            if "response" not in data:
                logger.error("Unexpected Ollama response shape: %s", data)
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Unexpected Ollama response")
            return data["response"]
        except requests.exceptions.Timeout:
            logger.exception("Ollama timed out")
            raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Ollama timed out — try again shortly")
        except requests.exceptions.ConnectionError:
            logger.exception("Cannot reach Ollama")
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Cannot reach Ollama service")
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Ollama error")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Ollama error: {exc}")
    else:
        # OpenAI path (synchronous)
        try:
            from openai import OpenAI
        except Exception as e:
            logger.exception("OpenAI client not available")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="OpenAI client not available")

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="OPENAI_API_KEY not configured")

        try:
            client = OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model=os.getenv("OPENAI_CHAT_MODEL", "gpt-4o"),
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
            )
            # adapt to response shape
            content = ""
            if hasattr(response, "choices") and response.choices:
                content = getattr(response.choices[0].message, "content", "") or response.choices[0].get("message", {}).get("content", "")
            return content or "No answer generated."
        except Exception as exc:
            logger.exception("OpenAI call failed")
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"OpenAI error: {exc}")


# -------------------------
# List documents for a course
# GET /rag/documents/{course_id}
# -------------------------
@router.get("/documents/{course_id}")
def list_documents(course_id: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, filename, chunk_count, created_at
            FROM documents
            WHERE course_id = %s
            ORDER BY created_at DESC
            """,
            (course_id,),
        )
        rows = cur.fetchall()
        docs = [dict(r) for r in rows]
        return {"documents": docs}
    except Exception as exc:
        logger.exception("list_documents failed")
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
# Get courses
# GET /rag/courses
# -------------------------
@router.get("/courses")
def get_courses():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, name, subject FROM courses ORDER BY id")
        rows = cur.fetchall()
        courses = [dict(r) for r in rows]
        return {"courses": courses}
    except Exception as exc:
        logger.exception("get_courses failed")
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