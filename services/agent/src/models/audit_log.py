"""Every meaningful agent action (PayPal call, LLM classification, decision)
gets a row here, tagged with the request_id from the logging middleware
(SA-Arch.md §9) — this is the durable half of "track the log of each thing";
structlog is the ephemeral half."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[str] = mapped_column(String(36))

    # "settlement_service" | "dispute_service" | "paypal_repository" | "llm_provider" | ...
    actor: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(64))
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    # clock_timestamp(), not now() — see models/settlement.py for why.
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.clock_timestamp())
