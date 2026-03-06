"""
database.py - SQLite connection and session setup for the Competitor Bank Analytics backend.

Creates the engine and session factory, initializes the database file,
and provides a dependency for FastAPI to get a DB session per request.

Uses NullPool for SQLite so each request gets its own connection. Sharing a single
SQLite connection across threads (e.g. StaticPool + check_same_thread=False) can
cause native crashes (SIGSEGV) in libsqlite3 on macOS when requests run concurrently.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool

from models import Base

# SQLite database file path (in backend folder, excluded from git if desired)
DB_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{os.path.join(DB_DIR, 'bank_analytics.db')}")

# SQLite connect_args: one connection per request (NullPool), so we do NOT share
# the connection across threads — each thread gets its own connection. This
# avoids SIGSEGV/crashes in libsqlite3 when multiple requests hit the DB at once.
# busy_timeout: wait up to 15s if the DB is locked instead of failing immediately.
_sqlite_connect_args = (
    {"timeout": 15.0}  # busy_timeout in seconds; check_same_thread stays True (default)
    if "sqlite" in DATABASE_URL
    else {}
)

engine = create_engine(
    DATABASE_URL,
    connect_args=_sqlite_connect_args,
    poolclass=NullPool if "sqlite" in DATABASE_URL else None,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Create all tables if they do not exist."""
    Base.metadata.create_all(bind=engine)


def get_db() -> Session:
    """Dependency that yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
