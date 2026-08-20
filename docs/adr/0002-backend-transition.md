# ADR 0002: FastAPI/SQLite development baseline

Status: accepted for the foundation milestone

Use FastAPI, SQLAlchemy 2, and SQLite during the first runnable milestone. Keep
queries and domain services database-neutral so PostgreSQL can replace SQLite.
Alembic/database-owned migrations remain the schema authority. Production is not
approved on SQLite.
