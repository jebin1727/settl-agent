"""Integration tests hit the REAL local Postgres (started via
`docker compose up -d postgres`) — unlike tests/unit, nothing here is
mocked. Each test runs inside a transaction that's rolled back afterward, so
the test DB stays clean without needing a separate teardown step.

Requires Postgres running locally (see README "Run locally") before these
tests will pass — that's intentional, not a bug: these prove the repository
layer works against a real database, which mocked unit tests can't do.
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import SessionLocal


@pytest_asyncio.fixture
async def db_session() -> AsyncSession:
    async with SessionLocal() as session:
        async with session.begin():
            yield session
            await session.rollback()


@pytest.fixture(autouse=True)
def _require_postgres():
    """Fails fast with a clear message instead of a cryptic connection
    traceback if Postgres isn't running when these tests are invoked."""
    import socket

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(1)
    try:
        sock.connect(("localhost", 5432))
    except OSError:
        pytest.skip("Postgres not reachable on localhost:5432 — run `docker compose up -d postgres` first")
    finally:
        sock.close()
