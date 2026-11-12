"""Controller-level test for disputes — same pattern as
test_settlements_api.py: PayPal/LLM are mocked out via the service
dependency override, so this only proves routing/auth/DTO wiring, not the
triage decision logic itself (that's test_dispute_service.py's job)."""

from decimal import Decimal
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from src.api.v1.disputes import get_dispute_service
from src.main import app
from src.schemas.dispute_dto import DisputeTriageResultDTO

client = TestClient(app)


def test_triage_dispute_requires_auth():
    response = client.post("/v1/disputes/PP-D-1/triage")
    assert response.status_code == 401


def test_triage_dispute_delegates_to_service():
    mock_service = AsyncMock()
    mock_service.triage.return_value = DisputeTriageResultDTO(
        dispute_id="PP-D-1",
        risk_score=Decimal("0.12"),
        decision="accept_claim",
        rationale="Small amount, low risk.",
        status="auto_resolved",
    )
    app.dependency_overrides[get_dispute_service] = lambda: mock_service

    try:
        response = client.post(
            "/v1/disputes/PP-D-1/triage", headers={"Authorization": "Bearer test-token"}
        )
    finally:
        del app.dependency_overrides[get_dispute_service]

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "auto_resolved"
    assert body["dispute_id"] == "PP-D-1"
    mock_service.triage.assert_awaited_once_with("PP-D-1")


def test_simulate_dispute_requires_auth():
    response = client.post("/v1/disputes/simulate", json={"reason": "ITEM_NOT_RECEIVED", "amount": "10.00"})
    assert response.status_code == 401


def test_simulate_dispute_delegates_to_service():
    mock_service = AsyncMock()
    mock_service.simulate.return_value = DisputeTriageResultDTO(
        dispute_id="SIMULATED-ABC123",
        risk_score=Decimal("0.10"),
        decision="accept_claim",
        rationale="Simulated: small amount, low risk.",
        status="auto_resolved",
    )
    app.dependency_overrides[get_dispute_service] = lambda: mock_service

    try:
        response = client.post(
            "/v1/disputes/simulate",
            json={"reason": "ITEM_NOT_RECEIVED", "amount": "10.00", "note": "test"},
            headers={"Authorization": "Bearer test-token"},
        )
    finally:
        del app.dependency_overrides[get_dispute_service]

    assert response.status_code == 200
    assert response.json()["dispute_id"].startswith("SIMULATED-")
    mock_service.simulate.assert_awaited_once()


def test_list_disputes_requires_auth():
    response = client.get("/v1/disputes")
    assert response.status_code == 401
