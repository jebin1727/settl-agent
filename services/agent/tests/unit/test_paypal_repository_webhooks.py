from unittest.mock import MagicMock, patch

import pytest

from src.core.errors import PayPalToolError
from src.repositories.paypal_repository import PayPalRepository


def _make_repo():
    settings = MagicMock(
        paypal_client_id="x", paypal_client_secret="x", paypal_environment="SANDBOX"
    )
    with patch("src.repositories.paypal_repository.PayPalAPI"), patch(
        "src.repositories.paypal_repository.PayPalClient"
    ) as mock_client_cls:
        repo = PayPalRepository(settings=settings)
        return repo, mock_client_cls.return_value


def test_verify_webhook_signature_success():
    repo, mock_client = _make_repo()
    mock_client.post.return_value = {"verification_status": "SUCCESS"}

    result = repo.verify_webhook_signature(
        headers={"paypal-transmission-id": "t1"}, webhook_id="WH-1", event_body={"event_type": "x"}
    )

    assert result is True
    mock_client.post.assert_called_once()
    _, payload = mock_client.post.call_args[0]
    assert payload["webhook_id"] == "WH-1"
    assert payload["transmission_id"] == "t1"


def test_verify_webhook_signature_failure():
    repo, mock_client = _make_repo()
    mock_client.post.return_value = {"verification_status": "FAILURE"}

    result = repo.verify_webhook_signature(headers={}, webhook_id="WH-1", event_body={})

    assert result is False


def test_verify_webhook_signature_raises_on_call_error():
    repo, mock_client = _make_repo()
    mock_client.post.side_effect = RuntimeError("network error")

    with pytest.raises(PayPalToolError):
        repo.verify_webhook_signature(headers={}, webhook_id="WH-1", event_body={})
