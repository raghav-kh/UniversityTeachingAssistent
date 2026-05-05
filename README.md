
# EduAI — AI-Assisted Teaching & Evaluation System

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + TypeScript + Tailwind + shadcn/ui |
| Backend | Python + FastAPI + LangChain |
| Primary DB | PostgreSQL 16 + pgvector |
| Graph DB | Neo4j 5 |
| Cache | Redis 7 |
| Local AI | Grok (cloud) |
| Cloud AI | GPT-4o / Gemini 1.5 Pro |

## Features
- RAG-powered content engine (PDF → chunks → embeddings → pgvector)
- Tiered AI grading (Tier-1 local free, Tier-2 cloud paid)
- 85% confidence threshold with auto-flagging
- Behavioral integrity tracking (keystrokes, paste detection)
- Auto-triggered micro-vivas
- Professor HITL review queue
- Neo4j knowledge dependency graph
- Redis semantic caching

## Running Locally

### Prerequisites
- Docker Desktop
- Node.js 18+
- Python 3.11+
- Ollama

### Start Infrastructure
docker compose up -d

### Start Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000 --timeout-keep-alive 300

### Start Frontend
cd frontend
npm install
npm run dev

### AI Model Configuration
Ensure `GROK_MODEL` (e.g., `grok-beta`) is set in `.env` and provide `XAI_API_KEY`.

## API Docs
http://localhost:8000/docs
```

---

## Your Complete System — Final State
```
┌─────────────────────────────────────────────────┐
│              EduAI — All Pages Live              │
├──────────────┬──────────────────────────────────┤
│ /dashboard   │ Live stats, activity, routing     │
│ /grading     │ Submit + keystroke tracked editor │
│ /review      │ Tinder swipe HITL queue           │
│ /integrity   │ Behavioral risk reports           │
│ /viva        │ AI oral exam interface            │
│ /rag         │ PDF upload + pgvector index       │
│ /tutor       │ RAG-grounded AI chat              │
│ /graph       │ Neo4j dependency graph            │
│ /router      │ Live cost + model analytics       │
└──────────────┴──────────────────────────────────┘

Backend APIs: 20+ endpoints across 5 routers
Databases: PostgreSQL + pgvector + Redis + Neo4j
AI Models: LLaMA 3.2 3B (local) + GPT-4o (cloud)
