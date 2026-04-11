"""Vercel Python entry: exposes `app` for the serverless runtime (see Vercel FastAPI docs)."""
from main import app

__all__ = ["app"]
