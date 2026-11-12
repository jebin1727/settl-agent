"""Postgres persistence — our durable mirror of settlement/dispute state and
the audit trail. See SA-Arch.md §4/§5: the Service layer calls these methods
without knowing or caring that they're backed by SQLAlchemy/Postgres."""

import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.audit_log import AuditLog
from src.models.dispute import Dispute
from src.models.settlement import Settlement


class SettlementRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(
        self, gross_amount: Decimal, platform_fee_amount: Decimal, provider_amount: Decimal
    ) -> Settlement:
        settlement = Settlement(
            gross_amount=gross_amount,
            platform_fee_amount=platform_fee_amount,
            provider_amount=provider_amount,
        )
        self._session.add(settlement)
        await self._session.flush()
        return settlement

    async def get(self, settlement_id: uuid.UUID) -> Settlement | None:
        return await self._session.get(Settlement, settlement_id)

    async def mark_paid_out(self, settlement: Settlement, paypal_payout_batch_id: str) -> Settlement:
        """The actual "settling" action succeeded — PayPal accepted the
        payout batch paying the provider their share. See
        settlement_service.create_and_payout."""
        settlement.paypal_payout_batch_id = paypal_payout_batch_id
        settlement.status = "paid_out"
        await self._session.flush()
        return settlement

    async def mark_failed(self, settlement: Settlement) -> Settlement:
        """Nothing happened on PayPal's side — the payout call itself
        failed outright (as opposed to mark_payout_failed, where a batch
        was accepted but PayPal later reports it as unsuccessful)."""
        settlement.status = "failed"
        await self._session.flush()
        return settlement

    async def mark_payout_failed(self, settlement: Settlement, paypal_payout_batch_id: str | None = None) -> Settlement:
        if paypal_payout_batch_id:
            settlement.paypal_payout_batch_id = paypal_payout_batch_id
        settlement.status = "payout_failed"
        await self._session.flush()
        return settlement

    async def list_recent(self, limit: int = 50) -> list[Settlement]:
        result = await self._session.execute(
            select(Settlement).order_by(Settlement.created_at.desc()).limit(limit)
        )
        return list(result.scalars().all())


class DisputeRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def upsert_from_paypal(self, paypal_dispute_id: str, settlement_id: uuid.UUID | None) -> Dispute:
        existing = await self._session.scalar(
            select(Dispute).where(Dispute.paypal_dispute_id == paypal_dispute_id)
        )
        if existing:
            return existing
        dispute = Dispute(paypal_dispute_id=paypal_dispute_id, settlement_id=settlement_id)
        self._session.add(dispute)
        await self._session.flush()
        return dispute

    async def record_decision(
        self,
        dispute: Dispute,
        *,
        risk_score: Decimal,
        decision: str,
        rationale: str,
        status: str,
        risk_breakdown: dict[str, float] | None = None,
        amount: Decimal | None = None,
        currency_code: str | None = None,
        reason: str | None = None,
    ) -> Dispute:
        dispute.risk_score = risk_score
        dispute.decision = decision
        dispute.rationale = rationale
        dispute.status = status
        dispute.risk_breakdown = risk_breakdown
        dispute.amount = amount
        dispute.currency_code = currency_code
        dispute.reason = reason
        await self._session.flush()
        return dispute

    async def list_recent(self, limit: int = 50) -> list[Dispute]:
        result = await self._session.execute(select(Dispute).order_by(Dispute.created_at.desc()).limit(limit))
        return list(result.scalars().all())


class AuditLogRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def record(self, *, request_id: str, actor: str, action: str, details: dict[str, Any]) -> AuditLog:
        entry = AuditLog(request_id=request_id, actor=actor, action=action, details=details)
        self._session.add(entry)
        await self._session.flush()
        return entry

    async def list_recent(self, limit: int = 100) -> list[AuditLog]:
        result = await self._session.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit))
        return list(result.scalars().all())
