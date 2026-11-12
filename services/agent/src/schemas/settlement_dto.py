"""DTOs for the settlement split calculation and the full settlement →
payout flow. Deliberately separate from the SQLAlchemy model in
models/settlement.py — see SA-Arch.md §8."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class SplitRequestDTO(BaseModel):
    gross_amount: Decimal = Field(gt=0, description="Total amount paid by the customer.")
    platform_fee_percent: Decimal = Field(ge=0, le=100, description="Platform's cut, as a percentage.")

    @field_validator("gross_amount", "platform_fee_percent")
    @classmethod
    def quantize_two_places(cls, value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"))


class SplitResultDTO(BaseModel):
    gross_amount: Decimal
    platform_fee_amount: Decimal
    provider_amount: Decimal


class CreateSettlementRequestDTO(BaseModel):
    """What triggers a settlement — in the real product this would come from
    a "job marked complete" webhook/event; for now it's a direct API call
    with the same shape."""

    gross_amount: Decimal = Field(gt=0)
    platform_fee_percent: Decimal = Field(ge=0, le=100)
    recipient_email: EmailStr = Field(
        description="The provider's PayPal email — paid their share directly via PayPal Payouts."
    )
    description: str = Field(min_length=1, max_length=200, description="What the payout note says.")

    @field_validator("gross_amount", "platform_fee_percent")
    @classmethod
    def quantize_two_places(cls, value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"))


class SettlementResultDTO(BaseModel):
    id: uuid.UUID
    gross_amount: Decimal
    platform_fee_amount: Decimal
    provider_amount: Decimal
    status: Literal["pending", "awaiting_approval", "rejected", "paid_out", "payout_failed", "failed"]
    paypal_payout_batch_id: str | None
    recipient_email: str | None = None
    description: str | None = None
    risk_score: Decimal | None = None
    risk_flags: list[dict] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
