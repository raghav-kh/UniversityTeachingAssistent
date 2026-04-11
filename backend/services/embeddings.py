import os
import logging
from typing import List

import requests
from dotenv import load_dotenv

load_dotenv()

# Configuration
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "openai").lower()
OPENAI_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
OLLAMA_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# Target dimension used in DB schema (pgvector)
TARGET_DIM = int(os.getenv("EMBEDDING_DIM", 1536))

# HTTP settings
OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", 30))

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EmbeddingError(Exception):
    """Raised when embedding generation fails."""


def _validate_and_pad(embedding: List[float]) -> List[float]:
    """Validate embedding is numeric list and pad/truncate to TARGET_DIM."""
    if not isinstance(embedding, list) or not all(isinstance(x, (float, int)) for x in embedding):
        raise EmbeddingError("Invalid embedding format returned by provider")

    # Convert ints to floats
    embedding = [float(x) for x in embedding]

    if len(embedding) == TARGET_DIM:
        return embedding
    if len(embedding) < TARGET_DIM:
        padding = [0.0] * (TARGET_DIM - len(embedding))
        return embedding + padding
    # If provider returns larger vector, truncate (should be avoided but safe)
    return embedding[:TARGET_DIM]


def get_openai_embedding(text: str) -> List[float]:
    """
    Get embedding from OpenAI using the official OpenAI Python client.
    Raises EmbeddingError on failure.
    """
    try:
        from openai import OpenAI
    except Exception as e:
        logger.error("OpenAI client not installed: %s", e)
        raise EmbeddingError("OpenAI client library is not available")

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise EmbeddingError("OPENAI_API_KEY is not set")

    try:
        client = OpenAI(api_key=api_key)
        response = client.embeddings.create(model=OPENAI_MODEL, input=text)
        embedding = response.data[0].embedding
        return _validate_and_pad(embedding)
    except Exception as exc:
        logger.exception("OpenAI embedding request failed")
        raise EmbeddingError(f"OpenAI embedding failed: {exc}")


def get_ollama_embedding(text: str) -> List[float]:
    """
    Get embedding from Ollama (local). Returns a list of floats padded to TARGET_DIM.
    Raises EmbeddingError on failure.
    """
    if not OLLAMA_BASE_URL:
        raise EmbeddingError("OLLAMA_BASE_URL is not configured")

    url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/embeddings"
    payload = {"model": OLLAMA_MODEL, "prompt": text}

    try:
        resp = requests.post(url, json=payload, timeout=OLLAMA_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except requests.exceptions.Timeout:
        logger.exception("Ollama embedding request timed out")
        raise EmbeddingError("Ollama embedding request timed out")
    except requests.exceptions.RequestException as e:
        logger.exception("Ollama embedding request failed")
        raise EmbeddingError(f"Ollama request failed: {e}")
    except ValueError:
        logger.exception("Invalid JSON from Ollama")
        raise EmbeddingError("Invalid JSON response from Ollama")

    # Ollama response shape may vary; try common keys
    embedding = None
    if isinstance(data, dict):
        # common key used in some local servers
        embedding = data.get("embedding") or data.get("data") or data.get("embeddings")
        # if embeddings nested under data[0].embedding
        if embedding is None and isinstance(data.get("data"), list) and data["data"]:
            embedding = data["data"][0].get("embedding")

    if embedding is None:
        logger.error("No embedding found in Ollama response: %s", data)
        raise EmbeddingError("No embedding found in Ollama response")

    try:
        return _validate_and_pad(embedding)
    except EmbeddingError:
        logger.exception("Invalid embedding returned by Ollama")
        raise


def get_embedding(text: str) -> List[float]:
    """
    Unified entry point. Returns a list of floats of length TARGET_DIM.
    Raises EmbeddingError on failure.
    """
    if not isinstance(text, str) or not text.strip():
        raise EmbeddingError("Text must be a non-empty string")

    provider = EMBEDDING_PROVIDER
    # Serverless hosts cannot reach a laptop Ollama; prefer OpenAI when deployed on Vercel.
    if os.getenv("VERCEL") == "1" and provider == "ollama" and os.getenv("OPENAI_API_KEY"):
        provider = "openai"
    logger.debug("Generating embedding using provider %s", provider)

    if provider == "ollama":
        return get_ollama_embedding(text)
    if provider == "openai":
        return get_openai_embedding(text)

    raise EmbeddingError(f"Unsupported EMBEDDING_PROVIDER: {EMBEDDING_PROVIDER}")