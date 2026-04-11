import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import init_db
from routers import rag, grading, integrity, graph
from routers.auth import router as auth_router
from routers.courses import router as courses_router
from routers.webhooks import router as webhooks_router

load_dotenv()


def _cors_origins() -> list:
    raw = os.getenv("CORS_ORIGINS", "").strip()
    origins = [o.strip() for o in raw.split(",") if o.strip()] if raw else []
    
    # Add your GitHub Pages URL here
    origins.extend([
        "http://localhost:3000",
        "https://raghav-kh.github.io", # Replace with your actual GitHub username/repo
    ])
    return origins


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Avoid schema init on every cold start; set RUN_DB_INIT=true for one-off bootstrap.
    if os.getenv("RUN_DB_INIT", "").lower() in ("1", "true", "yes"):
        init_db()
    yield


app = FastAPI(title="EduAI API", version="1.0.0", lifespan=lifespan)

_cors_kw = dict(
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
_cors_rx = os.getenv("CORS_ORIGIN_REGEX", "").strip()
if _cors_rx:
    _cors_kw["allow_origin_regex"] = _cors_rx
app.add_middleware(CORSMiddleware, **_cors_kw)

app.include_router(rag.router)
app.include_router(grading.router)
app.include_router(integrity.router)
app.include_router(graph.router)
app.include_router(auth_router)
app.include_router(courses_router)
app.include_router(webhooks_router)


@app.get("/health")
def health():
    return {"status": "ok"}
