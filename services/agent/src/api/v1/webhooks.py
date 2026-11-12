"""Controller: PayPal calls this directly — it's the one route in this
codebase that deliberately does NOT use require_internal_token (PayPal has
no way to know our internal bearer secret). Its security is the webhook
signature verification itself, which is why that check happens here before
anything else runs. See SA-Arch.md §4/§10.
"""

from arq.connections import ArqRedis
from fastapi import APIRouter, Depends, Request

from src.core.config import get_settings
from src.core.errors import AppError
from src.core.logging import get_logger
from src.core.queue import get_arq_pool
from src.core.rate_limit import limiter
from src.repositories.paypal_repository import PayPalRepository
from src.schemas.webhook_dto import PayPalWebhookEventDTO

logger = get_logger(__name__)

router = APIRouter(prefix="/webhooks/paypal", tags=["webhooks"])

# Event types this agent reacts to, and the job each one enqueues. Easy to
# extend (e.g. CUSTOMER.DISPUTE.UPDATED) without touching the route itself.
DISPUTE_CREATED = "CUSTOMER.DISPUTE.CREATED"


class WebhookSignatureInvalid(AppError):
    code = "webhook_signature_invalid"
    status_code = 401


def get_paypal_repository() -> PayPalRepository:
    return PayPalRepository()


async def get_queue_pool() -> ArqRedis:
    return await get_arq_pool()


@router.post("")
@limiter.limit("60/minute")
async def receive_paypal_webhook(
    request: Request,
    paypal_repo: PayPalRepository = Depends(get_paypal_repository),
    pool: ArqRedis = Depends(get_queue_pool),
) -> dict:
    raw_body = await request.json()
    event = PayPalWebhookEventDTO.model_validate(raw_body)
    settings = get_settings()

    if settings.paypal_webhook_id:
        headers = {k.lower(): v for k, v in request.headers.items()}
        verified = paypal_repo.verify_webhook_signature(headers, settings.paypal_webhook_id, raw_body)
        if not verified:
            logger.warning("webhook_signature_rejected", event_type=event.event_type, event_id=event.id)
            raise WebhookSignatureInvalid("PayPal webhook signature did not verify.")
    else:
        # Loud on purpose — this must never be silently skipped in a
        # deployment that's supposed to be verifying. Expected locally
        # (no public URL to register a real webhook against yet); not
        # expected once PAYPAL_WEBHOOK_ID is set after deploying.
        logger.warning(
            "webhook_signature_verification_skipped",
            reason="PAYPAL_WEBHOOK_ID not configured",
            event_type=event.event_type,
        )

    logger.info("webhook_received", event_type=event.event_type, event_id=event.id)

    if event.event_type == DISPUTE_CREATED:
        dispute_id = event.resource.get("dispute_id")
        if dispute_id:
            await pool.enqueue_job("triage_dispute_job", dispute_id)
            logger.info("dispute_triage_enqueued", dispute_id=dispute_id, event_id=event.id)

    # PayPal expects a fast 2xx — the real work happens in the worker, off
    # this request entirely. See SA-Arch.md §10.
    return {"status": "received"}
