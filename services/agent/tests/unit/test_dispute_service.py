"""Tests the triage decision logic in isolation — PayPal, the LLM, and the
DB repository are all mocked. This is deliberately where the heaviest
testing effort goes (SA-Arch.md §11): this is the actual "agentic" decision
that moves money, so the branching logic needs to be right, not just the
happy path.
"""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.schemas.dispute_dto import DisputeRiskAssessment, SimulateDisputeRequestDTO
from src.services.dispute_service import (
    AUTO_RESOLVE_THRESHOLD,
    DisputeService,
    build_synthetic_dispute_payload,
)


def _make_service(risk_score: float, recommended_action: str, llm_provider: str = "gemini"):
    paypal_repo = MagicMock()
    paypal_repo.get_dispute.return_value = {"dispute_id": "PP-D-1", "reason": "ITEM_NOT_RECEIVED"}

    dispute_repo = AsyncMock()
    dispute_row = MagicMock()
    dispute_repo.upsert_from_paypal.return_value = dispute_row

    audit_repo = AsyncMock()

    llm = MagicMock()
    structured = MagicMock()
    structured.ainvoke = AsyncMock(
        return_value=DisputeRiskAssessment(
            risk_score=risk_score,
            reasoning="Small amount, standard reason code, no fraud indicators.",
            recommended_action=recommended_action,
            fraud_risk=risk_score,
            policy_risk=risk_score,
            chargeback_risk=risk_score,
            identity_risk=risk_score,
            merchant_risk=risk_score,
        )
    )
    llm.with_structured_output.return_value = structured

    settings = MagicMock(llm_provider=llm_provider)
    token_bucket = AsyncMock()

    service = DisputeService(
        paypal_repo=paypal_repo,
        dispute_repo=dispute_repo,
        audit_repo=audit_repo,
        llm=llm,
        settings=settings,
        token_bucket=token_bucket,
    )
    return service, paypal_repo, dispute_repo, token_bucket, audit_repo


async def test_triage_auto_resolves_low_risk_dispute():
    service, paypal_repo, dispute_repo, _, _ = _make_service(risk_score=0.1, recommended_action="auto_resolve")

    result = await service.triage("PP-D-1")

    assert result.status == "auto_resolved"
    assert result.decision == "accept_claim"
    paypal_repo.accept_dispute_claim.assert_called_once()
    dispute_repo.record_decision.assert_awaited_once()
    _, kwargs = dispute_repo.record_decision.call_args
    assert kwargs["status"] == "auto_resolved"
    assert kwargs["risk_score"] == Decimal("0.1")


async def test_triage_escalates_high_risk_dispute():
    service, paypal_repo, dispute_repo, _, _ = _make_service(risk_score=0.8, recommended_action="escalate")

    result = await service.triage("PP-D-1")

    assert result.status == "escalated"
    assert result.decision == "escalate"
    paypal_repo.accept_dispute_claim.assert_not_called()


async def test_triage_escalates_when_llm_disagrees_with_its_own_score():
    """Belt-and-suspenders: low numeric risk_score but the LLM still
    recommended escalation. Escalation wins — see the comment in
    dispute_service.py explaining why this AND, not OR."""
    service, paypal_repo, dispute_repo, _, _ = _make_service(risk_score=0.1, recommended_action="escalate")

    result = await service.triage("PP-D-1")

    assert result.status == "escalated"
    paypal_repo.accept_dispute_claim.assert_not_called()


async def test_triage_at_exact_threshold_escalates():
    """risk_score < THRESHOLD, strictly — a score equal to the threshold
    should NOT auto-resolve."""
    service, paypal_repo, dispute_repo, _, _ = _make_service(
        risk_score=float(AUTO_RESOLVE_THRESHOLD), recommended_action="auto_resolve"
    )

    result = await service.triage("PP-D-1")

    assert result.status == "escalated"
    paypal_repo.accept_dispute_claim.assert_not_called()


async def test_triage_persists_rationale_text():
    service, _, dispute_repo, _, _ = _make_service(risk_score=0.1, recommended_action="auto_resolve")

    result = await service.triage("PP-D-1")

    assert "no fraud indicators" in result.rationale


async def test_triage_acquires_outbound_budget_for_gemini():
    service, _, _, token_bucket, _ = _make_service(
        risk_score=0.1, recommended_action="auto_resolve", llm_provider="gemini"
    )

    await service.triage("PP-D-1")

    token_bucket.acquire.assert_awaited_once()


async def test_triage_skips_outbound_budget_for_ollama():
    """Ollama is local/free — nothing to protect it from, see
    dispute_service.py's _classify_risk."""
    service, _, _, token_bucket, _ = _make_service(
        risk_score=0.1, recommended_action="auto_resolve", llm_provider="ollama"
    )

    await service.triage("PP-D-1")

    token_bucket.acquire.assert_not_awaited()


def test_build_synthetic_dispute_payload_shapes_request():
    request = SimulateDisputeRequestDTO(
        reason="ITEM_NOT_RECEIVED", amount=Decimal("25.00"), note="Buyer says package never arrived."
    )

    dispute_id, payload = build_synthetic_dispute_payload(request)

    assert dispute_id.startswith("SIMULATED-")
    assert payload["dispute_id"] == dispute_id
    assert payload["reason"] == "ITEM_NOT_RECEIVED"
    assert payload["dispute_amount"]["value"] == "25.00"
    assert "never arrived" in payload["buyer_message"]


def test_build_synthetic_dispute_payload_ids_are_unique():
    request = SimulateDisputeRequestDTO(reason="UNAUTHORIZED_TRANSACTION", amount=Decimal("10.00"))

    id_1, _ = build_synthetic_dispute_payload(request)
    id_2, _ = build_synthetic_dispute_payload(request)

    assert id_1 != id_2


async def test_simulate_never_calls_real_paypal():
    """The whole point of simulate() — real LLM reasoning, zero PayPal
    mutation, since there's no real dispute behind it."""
    service, paypal_repo, _, _, _ = _make_service(risk_score=0.1, recommended_action="auto_resolve")
    request = SimulateDisputeRequestDTO(reason="ITEM_NOT_RECEIVED", amount=Decimal("15.00"))

    result = await service.simulate(request)

    assert result.status == "auto_resolved"
    assert result.dispute_id.startswith("SIMULATED-")
    paypal_repo.get_dispute.assert_not_called()
    paypal_repo.accept_dispute_claim.assert_not_called()


async def test_simulate_tags_audit_record_as_simulated():
    service, _, _, _, audit_repo = _make_service(risk_score=0.8, recommended_action="escalate")
    request = SimulateDisputeRequestDTO(reason="SIGNIFICANTLY_NOT_AS_DESCRIBED", amount=Decimal("200.00"))

    await service.simulate(request)

    audit_repo.record.assert_awaited_once()
    _, kwargs = audit_repo.record.call_args
    assert kwargs["details"]["simulated"] is True
