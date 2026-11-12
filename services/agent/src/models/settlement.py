"""SQLAlchemy ORM model — our mirror of a settlement's state, NOT the API
contract (see schemas/settlement_dto.py for that, and SA-Arch.md §8 for why
the two are kept separate)."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class Settlement(Base):
    __tablename__ = "settlements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    gross_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    platform_fee_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    provider_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    # "pending" | "awaiting_approval" | "rejected" | "paid_out" | "payout_failed" | "failed"
    # awaiting_approval/rejected come from the Payment Guardian
    # (services/guardian.py): a settlement it flags is held, NOT paid, until
    # a human approves or rejects it.
    # (was "invoiced"/"send_failed" — the settlement used to INVOICE the
    # provider, i.e. bill them for their own earnings, backwards from what
    # "settling a job" should mean. Now it PAYS them via PayPal Payouts.
    # paypal_invoice_id kept, nullable, for any future feature that bills an
    # actual customer — not used by the provider-payout path below.)
    status: Mapped[str] = mapped_column(String(20), default="pending")

    # Stored at creation (not just used once) because a held settlement is
    # paid out LATER, on approval � the payout needs the recipient then.
    recipient_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Payment Guardian's pre-payout assessment: score 0-1 and the specific
    # named rules that fired (empty list = clean, auto-paid).
    risk_score: Mapped[Decimal | None] = mapped_column(Numeric(4, 3), nullable=True)
    risk_flags: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    paypal_invoice_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    paypal_payout_batch_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # clock_timestamp(), not now(): now()/CURRENT_TIMESTAMP is frozen at
    # transaction start in Postgres, so two rows inserted in the same
    # transaction get IDENTICAL created_at — breaks "most recent first"
    # ordering. clock_timestamp() is the actual wall-clock moment.
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.clock_timestamp())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp(), onupdate=func.clock_timestamp()
    )
