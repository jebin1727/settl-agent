"""Proves the test pipeline itself works end to end: app boots with the
isolated test Settings (tests/unit/conftest.py), the client can hit a route,
response shape is asserted. Every future controller test follows this
pattern.

/readyz specifically uses httpx.AsyncClient + ASGITransport, not the sync
TestClient used elsewhere — /readyz genuinely touches the global async
SQLAlchemy engine, and Starlette's sync TestClient runs requests on its own
internal event loop (separate from pytest-asyncio's session loop everything
else shares), which conflicts with a connection pool already bound to that
other loop by earlier async tests. httpx.AsyncClient runs on the current
(pytest-asyncio) loop instead, avoiding the conflict. Other controller tests
don't need this since they don't touch the real engine directly (DB-backed
routes go through dependency_overrides)."""

from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from src.main import app

client = TestClient(app)


def test_liveness_ok():
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_readiness_ok():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as async_client:
        response = await async_client.get("/readyz")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["checks"] == {"database": True, "redis": True}
