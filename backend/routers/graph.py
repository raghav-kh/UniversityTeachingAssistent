import os
import logging
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

router = APIRouter(prefix="/graph", tags=["Knowledge Graph"])


def _neo4j_config() -> Dict[str, str]:
    uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    user = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "secret123")
    return {"uri": uri, "user": user, "password": password}


def get_driver():
    """
    Create and return a Neo4j driver instance.
    Caller is responsible for closing the driver.
    """
    cfg = _neo4j_config()
    try:
        from neo4j import GraphDatabase
    except Exception as exc:
        logger.exception("neo4j driver not installed")
        raise RuntimeError("Neo4j driver not available") from exc

    try:
        driver = GraphDatabase.driver(cfg["uri"], auth=(cfg["user"], cfg["password"]))
        return driver
    except Exception as exc:
        logger.exception("Failed to create Neo4j driver")
        raise RuntimeError("Unable to connect to Neo4j") from exc


# -------------------------
# Pydantic models
# -------------------------
class TopicCreate(BaseModel):
    id: str = Field(..., min_length=1)
    label: str = Field(..., min_length=1)
    bloom: str = Field(..., min_length=1)
    course: str = Field(..., min_length=1)
    prerequisites: List[str] = Field(default_factory=list)


class SeedResult(BaseModel):
    message: str
    nodes: int
    edges: int


# -------------------------
# Seed default graph
# POST /graph/seed
# -------------------------
@router.post("/seed", response_model=SeedResult, status_code=status.HTTP_201_CREATED)
def seed_graph():
    driver = get_driver()
    nodes = [
        {"id": "variables", "label": "Variables", "bloom": "Remember", "course": "DSA"},
        {"id": "loops", "label": "Loops", "bloom": "Remember", "course": "DSA"},
        {"id": "functions", "label": "Functions", "bloom": "Understand", "course": "DSA"},
        {"id": "arrays", "label": "Arrays", "bloom": "Understand", "course": "DSA"},
        {"id": "recursion", "label": "Recursion", "bloom": "Apply", "course": "DSA"},
        {"id": "trees", "label": "Trees", "bloom": "Apply", "course": "DSA"},
        {"id": "graphs", "label": "Graphs", "bloom": "Analyze", "course": "DSA"},
        {"id": "dp", "label": "Dynamic Prog", "bloom": "Analyze", "course": "DSA"},
        {"id": "sorting", "label": "Sorting", "bloom": "Apply", "course": "DSA"},
        {"id": "searching", "label": "Searching", "bloom": "Apply", "course": "DSA"},
    ]
    edges = [
        ("variables", "loops"),
        ("variables", "arrays"),
        ("variables", "functions"),
        ("loops", "arrays"),
        ("loops", "sorting"),
        ("functions", "recursion"),
        ("arrays", "trees"),
        ("arrays", "sorting"),
        ("arrays", "searching"),
        ("recursion", "trees"),
        ("recursion", "dp"),
        ("trees", "graphs"),
        ("sorting", "searching"),
    ]

    try:
        with driver.session() as session:
            # clear existing Topic nodes
            session.run("MATCH (n:Topic) DETACH DELETE n")

            # create nodes using MERGE to avoid duplicates
            for node in nodes:
                session.run(
                    """
                    MERGE (t:Topic {id: $id})
                    SET t.label = $label, t.bloom = $bloom, t.course = $course
                    """,
                    **node,
                )

            # create relationships using MERGE
            for src, dst in edges:
                session.run(
                    """
                    MATCH (a:Topic {id: $src})
                    MATCH (b:Topic {id: $dst})
                    MERGE (a)-[:REQUIRED_FOR]->(b)
                    """,
                    src=src,
                    dst=dst,
                )
        return SeedResult(message="Graph seeded", nodes=len(nodes), edges=len(edges))
    except Exception as exc:
        logger.exception("Failed to seed graph")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to seed graph")
    finally:
        try:
            driver.close()
        except Exception:
            logger.debug("driver close failed")


# -------------------------
# Get full graph
# GET /graph/topics
# -------------------------
@router.get("/topics")
def get_graph():
    driver = get_driver()
    try:
        with driver.session() as session:
            nodes_result = session.run("MATCH (n:Topic) RETURN n.id AS id, n.label AS label, n.bloom AS bloom, n.course AS course")
            nodes = [{"id": r["id"], "label": r["label"], "bloom": r["bloom"], "course": r["course"]} for r in nodes_result]

            edges_result = session.run(
                "MATCH (a:Topic)-[:REQUIRED_FOR]->(b:Topic) RETURN a.id AS source, b.id AS target"
            )
            edges = [{"source": r["source"], "target": r["target"]} for r in edges_result]

        return {"nodes": nodes, "edges": edges}
    except Exception as exc:
        logger.exception("Failed to fetch graph")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch graph")
    finally:
        try:
            driver.close()
        except Exception:
            logger.debug("driver close failed")


# -------------------------
# Get prerequisites
# GET /graph/prerequisites/{topic_id}
# -------------------------
@router.get("/prerequisites/{topic_id}")
def get_prerequisites(topic_id: str):
    driver = get_driver()
    try:
        with driver.session() as session:
            result = session.run(
                """
                MATCH path = (prereq:Topic)-[:REQUIRED_FOR*1..]->(target:Topic {id: $id})
                RETURN DISTINCT prereq.label AS label, prereq.bloom AS bloom, length(path) AS depth
                ORDER BY depth ASC
                """,
                id=topic_id,
            )
            prerequisites = [{"label": r["label"], "bloom": r["bloom"], "depth": r["depth"]} for r in result]
        return {"topic_id": topic_id, "prerequisites": prerequisites}
    except Exception as exc:
        logger.exception("Failed to fetch prerequisites for %s", topic_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch prerequisites")
    finally:
        try:
            driver.close()
        except Exception:
            logger.debug("driver close failed")


# -------------------------
# Add custom topic
# POST /graph/topic
# -------------------------
@router.post("/topic", status_code=status.HTTP_201_CREATED)
def add_topic(topic: TopicCreate):
    driver = get_driver()
    try:
        with driver.session() as session:
            # create or update topic node
            session.run(
                """
                MERGE (t:Topic {id: $id})
                SET t.label = $label, t.bloom = $bloom, t.course = $course
                """,
                id=topic.id,
                label=topic.label,
                bloom=topic.bloom,
                course=topic.course,
            )

            # create prerequisite relationships
            for prereq_id in topic.prerequisites:
                session.run(
                    """
                    MATCH (a:Topic {id: $src})
                    MATCH (b:Topic {id: $dst})
                    MERGE (a)-[:REQUIRED_FOR]->(b)
                    """,
                    src=prereq_id,
                    dst=topic.id,
                )
        return {"message": f"Topic '{topic.label}' added"}
    except Exception as exc:
        logger.exception("Failed to add topic %s", topic.id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to add topic")
    finally:
        try:
            driver.close()
        except Exception:
            logger.debug("driver close failed")