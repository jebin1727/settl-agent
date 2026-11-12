"""Two distinct rate-limiting concerns, both backed by Redis:

1. Inbound: slowapi limiter on API routes, protects this service from being
   hammered (by a bug, a retry storm, or a judge double-clicking a button).
2. Outbound: a token-bucket around LLM provider calls specifically, protects
   our free-tier Gemini quota from being exhausted mid-demo. This is NOT the
   same thing as (1) and slowapi doesn't cover it — see llm_provider.py.
"""

import time

import redis.asyncio as redis
from slowapi import Limiter
from slowapi.util import get_remote_address

from src.core.config import get_settings
from src.core.errors import RateLimitedError

settings = get_settings()

limiter = Limiter(key_func=get_remote_address, storage_uri=settings.redis_url)

redis_client = redis.from_url(settings.redis_url)


class OutboundTokenBucket:
    """A simple Redis-backed token bucket for rate-limiting our own outbound
    calls to a quota-limited provider (e.g. Gemini free tier)."""

    def __init__(self, redis_client: redis.Redis, key: str, max_calls: int, per_seconds: int):
        self._redis = redis_client
        self._key = key
        self._max_calls = max_calls
        self._per_seconds = per_seconds

    async def acquire(self) -> None:
        now = time.time()
        window_start = now - self._per_seconds
        pipe = self._redis.pipeline()
        pipe.zremrangebyscore(self._key, 0, window_start)
        pipe.zcard(self._key)
        _, count = await pipe.execute()
        if count >= self._max_calls:
            raise RateLimitedError(
                f"Outbound call budget exceeded ({self._max_calls} per {self._per_seconds}s)."
            )
        await self._redis.zadd(self._key, {str(now): now})
        await self._redis.expire(self._key, self._per_seconds)


def get_gemini_token_bucket() -> OutboundTokenBucket:
    # gemini-3.8-flash free tier is confirmed (live, via a 429 response body)
    # at 5 requests/minute — budget strictly under that so our own
    # RateLimitedError (fast, clean 429) fires before Gemini's own quota
    # does. Hitting Gemini's real limit is far worse than hitting ours: its
    # client retries with blocking backoff (observed 38-53s per attempt),
    # which starves every other request on this process, not just the
    # caller's. See Track.md for the incident this was found from.
    return OutboundTokenBucket(redis_client, key="llm:gemini:calls", max_calls=4, per_seconds=60)
