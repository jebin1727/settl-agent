"""Async SQLAlchemy engine/session setup. Postgres is OUR mirror of PayPal
state for fast queries and the audit trail — PayPal sandbox remains the
system of record for money movement. See SA-Arch.md §5."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from src.core.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields a session, commits once the request's
    business logic completes without error, rolls back on exception, always
    closed after. Repository methods only `flush()` (push to the DB within
    the transaction, so later queries in the same request see it) — they
    deliberately don't commit themselves, since the request, not the
    repository, owns the transaction boundary."""
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
