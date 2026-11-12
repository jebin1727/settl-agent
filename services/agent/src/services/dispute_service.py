"""The autonomous dispute-triage logic — the heart of "agentic" in this
project. Fetches a dispute from PayPal, asks the LLM to assess risk with a
visible rationale (not a black-box yes/no), and either auto-resolves
low-risk cases or escalates ambiguous ones. Every decision is persisted with
its reasoning — see SA-Arch.md §9 on why that's a feature, not just logging.
"""

import json
import uuid
from decimal import Decimal

from langchain_core.language_models.chat_models import BaseChatModel

from src.core.config import Settings, get_settings
from src.core.logging import get_logger, get_request_id
from src.core.rate_limit import OutboundTokenBucket, get_gemini_token_bucket
from src.repositories.ledger_repository import AuditLogRepository, DisputeRepository
from src.repositories.paypal_repository import PayPalRepository
from src.schemas.dispute_dto import DisputeRiskAssessment, DisputeTriageResultDTO, SimulateDisputeRequestDTO
from src.services.llm_provider import get_llm

logger = get_logger(__name__)

# Below this risk score, the agent resolves the dispute itself. Above it,
# the case is escalated with the agent's reasoning attached so a human
# doesn't start from zero. Tuned conservative on purpose: a hackathon demo
# only needs to show the mechanism works, not that the threshold is
# perfectly calibrated — that would need real dispute-outcome data we don't
# have yet.
AUTO_RESOLVE_THRESHOLD = Decimal("0.3")

RISK_ASSESSMENT_PROMPT = """You are a dispute-risk analyst for a marketplace settlement agent.
Assess the risk of auto-resolving this PayPal dispute in the buyer's favor (i.e. accepting \
the claim) versus escalating it to a human for review.

Favor auto-resolving when: the disputed amount is small, the reason code suggests a low-stakes \
or ambiguous case (e.g. "item not received" with no tracking dispute), or there's nothing \
suggesting fraud or a high-value disagreement.

Favor escalating when: the amount is large, the reason code suggests fraud or a significant \
quality/not-as-described dispute, or the data is incomplete enough that a wrong auto-decision \
would be costly.

Dispute data from PayPal:
{dispute_json}

Give a risk_score from 0.0 (clearly safe to auto-resolve) to 1.0 (high risk, must escalate), \
your reasoning citing specific factors from the data above, and a recommended_action."""


def build_synthetic_dispute_payload(request: SimulateDisputeRequestDTO) -> tuple[str, dict]:
    """Shapes a SimulateDisputeRequestDTO into a PayPal-dispute-ish dict —
    the same shape _classify_risk() already expects (it just json.dumps()s
    whatever get_dispute() would have returned). Doesn't need to match
    PayPal's real schema field-for-field; it only has to carry the same
    information the real prompt reasons over. The dispute_id is prefixed
    SIMULATED- so it's never mistaken for a real PayPal dispute ID anywhere
    it's displayed or logged."""
    dispute_id = f"SIMULATED-{uuid.uuid4().hex[:12].upper()}"
    payload = {
        "dispute_id": dispute_id,
        "reason": request.reason,
        "status": request.status,
        "dispute_amount": {"currency_code": request.currency_code, "value": str(request.amount)},
        "buyer_message": request.note or "",
        "_note": "This is a SIMULATED dispute for demo purposes — not a real PayPal dispute.",
    }
    return dispute_id, payload


class DisputeService:
    def __init__(
        self,
        paypal_repo: PayPalRepository,
        dispute_repo: DisputeRepository,
        audit_repo: AuditLogRepository,
        llm: BaseChatModel | None = None,
        settings: Settings | None = None,
        token_bucket: OutboundTokenBucket | None = None,
    ):
        self._paypal = paypal_repo
        self._disputes = dispute_repo
        self._audit = audit_repo
        self._settings = settings or get_settings()
        self._llm = llm or get_llm(self._settings)
        self._token_bucket = token_bucket or get_gemini_token_bucket()

    async def triage(self, paypal_dispute_id: str) -> DisputeTriageResultDTO:
        dispute_payload = self._paypal.get_dispute(paypal_dispute_id)
        return await self._triage_payload(paypal_dispute_id, dispute_payload, simulated=False)

    async def simulate(self, request: SimulateDisputeRequestDTO) -> DisputeTriageResultDTO:
        """Demo-safe path: runs the exact same LLM reasoning, decision
        threshold, and persistence as triage() — the risk assessment is
        100% real, not canned — but against a payload built from caller-
        supplied fields instead of one fetched from a real PayPal dispute,
        and without ever calling accept_dispute_claim (there's no real
        dispute to resolve). Exists because the one real dispute needs a
        manual sandbox bootstrap step (Track.md) that shouldn't gate either
        a demo video or a judge trying the agent out. Every persisted row
        and log line is tagged `simulated: true` — never conflated with a
        real resolution.
        """
        dispute_id, synthetic_payload = build_synthetic_dispute_payload(request)
        return await self._triage_payload(dispute_id, synthetic_payload, simulated=True)

    async def _triage_payload(
        self, dispute_id: str, dispute_payload: dict, *, simulated: bool
    ) -> DisputeTriageResultDTO:
        assessment = await self._classify_risk(dispute_payload)
        risk_score = Decimal(str(round(assessment.risk_score, 3)))

        dispute = await self._disputes.upsert_from_paypal(dispute_id, settlement_id=None)

        # Both signals must agree it's safe — the LLM's categorical
        # recommendation AND the numeric threshold. Either one alone
        # recommending escalation is enough to escalate; this is a
        # deliberate belt-and-suspenders choice for a financial decision.
        if assessment.recommended_action == "auto_resolve" and risk_score < AUTO_RESOLVE_THRESHOLD:
            if not simulated:
                self._paypal.accept_dispute_claim(
                    dispute_id,
                    note=f"Auto-resolved by SettlAgent (risk {risk_score}): {assessment.reasoning}",
                )
            status, decision = "auto_resolved", "accept_claim"
            logger.info(
                "dispute_auto_resolved", dispute_id=dispute_id, risk_score=float(risk_score), simulated=simulated
            )
        else:
            status, decision = "escalated", "escalate"
            logger.info(
                "dispute_escalated", dispute_id=dispute_id, risk_score=float(risk_score), simulated=simulated
            )

        await self._disputes.record_decision(
            dispute,
            risk_score=risk_score,
            decision=decision,
            rationale=assessment.reasoning,
            status=status,
        )
        await self._audit.record(
            request_id=get_request_id(),
            actor="dispute_service",
            action="dispute_triaged",
            details={
                "dispute_id": dispute_id,
                "risk_score": float(risk_score),
                "decision": decision,
                "status": status,
                "rationale": assessment.reasoning,
                "llm_provider": self._settings.llm_provider,
                "simulated": simulated,
            },
        )

        return DisputeTriageResultDTO(
            dispute_id=dispute_id,
            risk_score=risk_score,
            decision=decision,
            rationale=assessment.reasoning,
            status=status,
        )

    async def _classify_risk(self, dispute_payload: dict) -> DisputeRiskAssessment:
        # Outbound budget only matters for a quota-limited hosted provider —
        # Ollama is local/free, so there's nothing to protect it from. See
        # SA-Arch.md §10 and core/rate_limit.py's get_gemini_token_bucket.
        if self._settings.llm_provider == "gemini":
            await self._token_bucket.acquire()

        structured_llm = self._llm.with_structured_output(DisputeRiskAssessment)
        prompt = RISK_ASSESSMENT_PROMPT.format(dispute_json=json.dumps(dispute_payload, indent=2))
        return await structured_llm.ainvoke(prompt)
