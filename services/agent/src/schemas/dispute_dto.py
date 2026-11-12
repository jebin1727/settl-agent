import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class DisputeRiskAssessment(BaseModel):
    """What the LLM returns via structured output — see
    services/dispute_service.py. This is the model's reasoning made
    inspectable, not a black box: risk_score and reasoning both get
    persisted to the audit trail and surfaced in the dashboard.

    The five *_risk fields are the same overall assessment broken into
    named factors (for the dashboard's radar chart) — not five separate
    model calls, one call asked to reason about five angles at once."""

    risk_score: float = Field(ge=0, le=1, description="0 = clearly safe to auto-resolve, 1 = high risk")
    reasoning: str = Field(description="Why this risk score — cite specific factors from the dispute data")
    recommended_action: Literal["auto_resolve", "escalate"]

    fraud_risk: float = Field(ge=0, le=1, description="Likelihood this is fraudulent, not a genuine dispute")
    policy_risk: float = Field(ge=0, le=1, description="Likelihood PayPal/merchant policy doesn't clearly favor either side")
    chargeback_risk: float = Field(ge=0, le=1, description="Likelihood this escalates into a card-network chargeback")
    identity_risk: float = Field(ge=0, le=1, description="Likelihood the buyer/account identity itself is suspicious")
    merchant_risk: float = Field(ge=0, le=1, description="Likelihood the merchant/provider side is at fault")

    def as_breakdown(self) -> dict[str, float]:
        return {
            "fraud_risk": self.fraud_risk,
            "policy_risk": self.policy_risk,
            "chargeback_risk": self.chargeback_risk,
            "identity_risk": self.identity_risk,
            "merchant_risk": self.merchant_risk,
        }


class DisputeTriageResultDTO(BaseModel):
    dispute_id: str
    risk_score: Decimal
    decision: Literal["accept_claim", "escalate"]
    rationale: str
    status: Literal["auto_resolved", "escalated"]


class SimulateDisputeRequestDTO(BaseModel):
    """A friendly shape for the demo-safe path — the caller doesn't need to
    construct a real PayPal dispute payload by hand. See
    DisputeService.simulate() and api/v1/disputes.py."""

    reason: Literal[
        "ITEM_NOT_RECEIVED",
        "SIGNIFICANTLY_NOT_AS_DESCRIBED",
        "UNAUTHORIZED_TRANSACTION",
        "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    ]
    amount: Decimal = Field(gt=0)
    currency_code: str = Field(default="USD", max_length=3)
    status: Literal["WAITING_FOR_SELLER_RESPONSE", "UNDER_REVIEW", "RESOLVED"] = "WAITING_FOR_SELLER_RESPONSE"
    note: str | None = Field(default=None, max_length=500, description="Extra context fed to the agent's reasoning.")


class DisputeSummaryDTO(BaseModel):
    """Our DB's view of a dispute — for the dashboard. Distinct from the
    PayPal API's own dispute shape, which `paypal_repository.get_dispute()`
    returns raw."""

    id: uuid.UUID
    paypal_dispute_id: str
    status: Literal["open", "auto_resolved", "escalated", "closed"]
    risk_score: Decimal | None
    decision: Literal["accept_claim", "refund", "escalate"] | None
    rationale: str | None
    risk_breakdown: dict[str, float] | None
    amount: Decimal | None
    currency_code: str | None
    reason: str | None
    created_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}
