import os
import psycopg2
import redis
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv(dotenv_path="c:/eduai/.env")
postgres_url = os.getenv("POSTGRES_URL")
# Test PostgreSQL
try:
    conn = psycopg2.connect(os.getenv("POSTGRES_URL"))
    print("✅ PostgreSQL connected")
    conn.close()
except Exception as e:
    print(f"❌ PostgreSQL failed: {e}")

# Test Redis
try:
    r = redis.from_url(os.getenv("REDIS_URL"))
    r.ping()
    print("✅ Redis connected")
except Exception as e:
    print(f"❌ Redis failed: {e}")

# Test Neo4j
try:
    driver = GraphDatabase.driver(
        os.getenv("NEO4J_URI"),
        auth=(os.getenv("NEO4J_USER"), os.getenv("NEO4J_PASSWORD"))
    )
    driver.verify_connectivity()
    print("✅ Neo4j connected")
    driver.close()
except Exception as e:
    print(f"❌ Neo4j failed: {e}")