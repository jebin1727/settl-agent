"""Arq job enqueueing — the FastAPI side of the queue. workers/worker.py is
the consuming side, running as its own container/process. See SA-Arch.md
§10: webhook processing is async by design — acknowledge PayPal fast,
return 200 immediately, do the actual triage work after, off the request
path entirely.
"""

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from src.core.config import get_settings

_pool: ArqRedis | None = None


async def get_arq_pool() -> ArqRedis:
    """Lazily-created, reused across requests — one Redis connection pool
    for the life of the process, not one per enqueue call."""
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    return _pool
