from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from db import init_db
from routers import rag, grading, integrity, graph
from routers.auth import router as auth_router
from routers.courses import router as courses_router
load_dotenv()

app = FastAPI(title="EduAI API", version="1.0.0")

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # consider env-based config
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event
@app.on_event("startup")
async def on_startup():
    init_db()

# Routers
app.include_router(rag.router)
app.include_router(grading.router)
app.include_router(integrity.router)
app.include_router(graph.router)
app.include_router(auth_router)
app.include_router(courses_router)

# Health check
@app.get("/health")
def health():
    return {"status": "ok"}