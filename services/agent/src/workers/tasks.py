"""Arq background jobs. Anything with external-API latency (PayPal, LLM
calls) is enqueued here instead of run inline in a request handler — see
SA-Arch.md §10 for why (and why this is also the correct pattern for
acknowledging PayPal webhooks fast and processing after)."""

from src.core.database import SessionLocal
from src.core.logging import get_logger
from src.repositories.ledger_repository import AuditLogRepository, DisputeRepository
from src.repositories.paypal_repository import PayPalRepository
from src.services.dispute_service import DisputeService

logger = get_logger(__name__)


async def ping(ctx) -> str:
    """Smoke-test task — confirms the worker + Redis + app wiring all work
    together before any real job is written."""
    logger.info("worker_ping")
    return "pong"


async def triage_dispute_job(ctx, dispute_id: str) -> str:
    """The autonomous path: api/v1/webhooks.py enqueues this the moment
    PayPal tells us a dispute was created — no human clicked anything. This
    is what makes the agent event-driven rather than request-triggered.

    Runs in the worker process, not a request — it owns its own DB session
    (FastAPI's get_db_session is a request-scoped dependency, not usable
    here) and its own commit/rollback, same contract as that dependency.
    """
    logger.info("webhook_triage_job_started", dispute_id=dispute_id)
    async with SessionLocal() as session:
        try:
            service = DisputeService(
                paypal_repo=PayPalRepository(),
                dispute_repo=DisputeRepository(session),
                audit_repo=AuditLogRepository(session),
            )
            result = await service.triage(dispute_id)
            await session.commit()
            logger.info(
                "webhook_triage_job_completed",
                dispute_id=dispute_id,
                status=result.status,
                decision=result.decision,
            )
            return result.status
        except Exception:
            await session.rollback()
            logger.error("webhook_triage_job_failed", dispute_id=dispute_id, exc_info=True)
            raise
