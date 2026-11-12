"""Controller-level tests — PayPal and the queue are mocked via dependency
overrides. This is deliberately NOT behind require_internal_token (PayPal
calls it directly) — the signature check is what's being tested here,
unlike every other controller test which tests the bearer-auth dependency.
"""

from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

from src.api.v1.webhooks import get_paypal_repository, get_queue_pool
from src.main import app

client = TestClient(app)

DISPUTE_CREATED_PAYLOAD = {
    "id": "WH-TEST-1",
    "event_type": "CUSTOMER.DISPUTE.CREATED",
    "resource_type": "dispute",
    "resource": {"dispute_id": "PP-D-TEST-1"},
}


def _override(paypal_repo=None, pool=None):
    app.dependency_overrides[get_paypal_repository] = lambda: paypal_repo or MagicMock()
    app.dependency_overrides[get_queue_pool] = lambda: pool or AsyncMock()


def _clear_overrides():
    app.dependency_overrides.pop(get_paypal_repository, None)
    app.dependency_overrides.pop(get_queue_pool, None)


def test_dispute_created_event_enqueues_triage_job():
    """No PAYPAL_WEBHOOK_ID configured in the test Settings (tests/unit/
    conftest.py) — signature verification is skipped, loudly, by design."""
    pool = AsyncMock()
    _override(pool=pool)

    try:
        response = client.post("/webhooks/paypal", json=DISPUTE_CREATED_PAYLOAD)
    finally:
        _clear_overrides()

    assert response.status_code == 200
    pool.enqueue_job.assert_awaited_once_with("triage_dispute_job", "PP-D-TEST-1")


def test_unrelated_event_type_does_not_enqueue():
    pool = AsyncMock()
    _override(pool=pool)

    try:
        response = client.post(
            "/webhooks/paypal",
            json={"id": "WH-TEST-2", "event_type": "PAYMENT.CAPTURE.COMPLETED", "resource": {}},
        )
    finally:
        _clear_overrides()

    assert response.status_code == 200
    pool.enqueue_job.assert_not_awaited()


def test_rejects_when_signature_verification_fails():
    """Exercises the verification branch directly — rather than mutate the
    shared test Settings singleton to set a webhook ID (risking leaking
    into other tests), this calls the route function with a Settings
    double that has one configured, via monkeypatching get_settings."""
    import src.api.v1.webhooks as webhooks_module

    paypal_repo = MagicMock()
    paypal_repo.verify_webhook_signature.return_value = False
    pool = AsyncMock()
    _override(paypal_repo=paypal_repo, pool=pool)

    fake_settings = MagicMock(paypal_webhook_id="WH-CONFIGURED")
    original_get_settings = webhooks_module.get_settings
    webhooks_module.get_settings = lambda: fake_settings

    try:
        response = client.post("/webhooks/paypal", json=DISPUTE_CREATED_PAYLOAD)
    finally:
        webhooks_module.get_settings = original_get_settings
        _clear_overrides()

    assert response.status_code == 401
    pool.enqueue_job.assert_not_awaited()
