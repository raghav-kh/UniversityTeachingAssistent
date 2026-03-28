-- Run this against your PostgreSQL eduai database
-- psql -U admin -d eduai -f migrate_day9.sql

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed a default admin  (password: admin123)
-- bcrypt hash of "admin123"
INSERT INTO users (name, username, password_hash, role)
VALUES (
    'Admin',
    'admin',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    'admin'
)
ON CONFLICT (username) DO NOTHING;

-- Seed demo teacher  (password: teach123)
INSERT INTO users (name, username, password_hash, role)
VALUES (
    'Dr. Priya',
    'teacher1',
    '$2b$12$vKQ1P0AaDhYpwJ5S.mGQ0OJMnf4q2n2NqX9q7HtZfSTHkjZFYcLM2',
    'teacher'
)
ON CONFLICT (username) DO NOTHING;

-- Seed demo student  (password: student123)
INSERT INTO users (name, username, password_hash, role)
VALUES (
    'Ravi Kumar',
    'student1',
    '$2b$12$LRVExPWHerQ9Ru7uNVr5BuXl/AEF3bkrJw5WG0JKjq.2C9dxQAkLi',
    'student'
)
ON CONFLICT (username) DO NOTHING;