"""Controller-level test: proves routing, auth dependency, and request/
response DTO validation all work together — not the money math again (that's
test_settlement_service.py's job). Uses the isolated test Settings from
tests/unit/conftest.py, where AGENT_INTERNAL_TOKEN="test-token" is set via
FastAPI's dependency_overrides."""

from decimal import Decimal
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from src.api.v1.settlements import get_settlement_service
from src.main import app
from src.schemas.settlement_dto import SettlementResultDTO

client = TestClient(app)


def _fake_settlement_result() -> SettlementResultDTO:
    return SettlementResultDTO(
        id="11111111-1111-1111-1111-111111111111",
        gross_amount=Decimal("100.00"),
        platform_fee_amount=Decimal("10.00"),
        provider_amount=Decimal("90.00"),
        status="paid_out",
        paypal_payout_batch_id="QM8CHGYYVSG6C",
        created_at="2026-11-03T00:00:00Z",
    )


def test_calculate_split_requires_auth():
    response = client.post(
        "/v1/settlements/calculate-split",
        json={"gross_amount": "100", "platform_fee_percent": "10"},
    )
    assert response.status_code == 401


def test_calculate_split_with_valid_token():
    response = client.post(
        "/v1/settlements/calculate-split",
        json={"gross_amount": "100", "platform_fee_percent": "10"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["platform_fee_amount"] == "10.00"
    assert body["provider_amount"] == "90.00"


def test_calculate_split_rejects_invalid_payload():
    response = client.post(
        "/v1/settlements/calculate-split",
        json={"gross_amount": "-5", "platform_fee_percent": "10"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 422


def test_create_settlement_requires_auth():
    response = client.post(
        "/v1/settlements",
        json={
            "gross_amount": "100.00",
            "platform_fee_percent": "10",
            "recipient_email": "provider@example.com",
            "description": "test",
        },
    )
    assert response.status_code == 401


def test_create_settlement_delegates_to_service():
    """Controller wiring only — PayPal/DB are entirely mocked out via the
    service dependency override. Real PayPal behavior is covered by
    test_settlement_service.py and the live smoke tests in Track.md."""
    mock_service = AsyncMock()
    mock_service.create_and_payout.return_value = _fake_settlement_result()
    app.dependency_overrides[get_settlement_service] = lambda: mock_service

    try:
        response = client.post(
            "/v1/settlements",
            json={
                "gross_amount": "100.00",
                "platform_fee_percent": "10",
                "recipient_email": "provider@example.com",
                "description": "test",
            },
            headers={"Authorization": "Bearer test-token"},
        )
    finally:
        del app.dependency_overrides[get_settlement_service]

    assert response.status_code == 200
    assert response.json()["paypal_payout_batch_id"] == "QM8CHGYYVSG6C"
    mock_service.create_and_payout.assert_awaited_once()


def test_create_settlement_rejects_invalid_email():
    response = client.post(
        "/v1/settlements",
        json={
            "gross_amount": "100.00",
            "platform_fee_percent": "10",
            "recipient_email": "not-an-email",
            "description": "test",
        },
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 422


def test_list_settlements_requires_auth():
    response = client.get("/v1/settlements")
    assert response.status_code == 401
