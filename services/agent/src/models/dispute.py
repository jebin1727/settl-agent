"""The dispute-triage record — this is where the agent's reasoning is
persisted (`rationale`), not just its final action. That's what makes the
reasoning log in the dashboard possible; see SA-Arch.md §9."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class Dispute(Base):
    __tablename__ = "disputes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    paypal_dispute_id: Mapped[str] = mapped_column(String(64), unique=True)
    settlement_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("settlements.id"), nullable=True
    )

    # "open" | "auto_resolved" | "escalated" | "closed"
    status: Mapped[str] = mapped_column(String(20), default="open")

    risk_score: Mapped[Decimal | None] = mapped_column(Numeric(4, 3), nullable=True)
    # "accept_claim" | "refund" | "escalate" | None (not yet decided)
    decision: Mapped[str | None] = mapped_column(String(20), nullable=True)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)

    # clock_timestamp(), not now() — see settlement.py for why.
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.clock_timestamp())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
