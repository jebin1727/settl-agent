"""Controller: liveness/readiness. No business logic here — Docker and Render
both poll this to know whether to route traffic / restart the container."""

from fastapi import APIRouter, Response, status
from sqlalchemy import text

from src.core.database import engine
from src.core.logging import get_logger
from src.core.rate_limit import redis_client

logger = get_logger(__name__)

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def liveness() -> dict:
    """Is the process alive at all — deliberately checks nothing external.
    A dependency outage shouldn't make Docker think the process itself is
    dead and restart it; that's what /readyz is for."""
    return {"status": "ok"}


@router.get("/readyz")
async def readiness(response: Response) -> dict:
    """Is the process ready to serve traffic — actually pings Postgres and
    Redis rather than claiming readiness unconditionally. Returns 503 (not
    200) when degraded, so this behaves as a real readiness probe for
    anything that checks the status code rather than parsing the body."""
    checks = {"database": False, "redis": False}

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception as exc:
        logger.warning("readiness_check_failed", dependency="database", error=str(exc))

    try:
        await redis_client.ping()
        checks["redis"] = True
    except Exception as exc:
        logger.warning("readiness_check_failed", dependency="redis", error=str(exc))

    is_ready = all(checks.values())
    response.status_code = status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "ok" if is_ready else "degraded", "checks": checks}
