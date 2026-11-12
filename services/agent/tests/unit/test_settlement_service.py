"""The money math, tested hard — this is exactly the kind of logic
SA-Arch.md §11 says to test exhaustively (business logic), as opposed to
re-testing what the SDK/framework already guarantees."""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.core.errors import PayPalToolError
from src.schemas.settlement_dto import CreateSettlementRequestDTO, SplitRequestDTO
from src.services.settlement_service import SettlementService, _extract_payout_batch_id, calculate_split


@pytest.mark.parametrize(
    ("gross", "fee_percent", "expected_fee", "expected_provider"),
    [
        ("100.00", "10", "10.00", "90.00"),
        ("49.99", "15", "7.50", "42.49"),
        ("1.00", "0", "0.00", "1.00"),
        ("1.00", "100", "1.00", "0.00"),
        ("33.33", "33", "11.00", "22.33"),
    ],
)
def test_calculate_split(gross, fee_percent, expected_fee, expected_provider):
    request = SplitRequestDTO(gross_amount=Decimal(gross), platform_fee_percent=Decimal(fee_percent))

    result = calculate_split(request)

    assert result.platform_fee_amount == Decimal(expected_fee)
    assert result.provider_amount == Decimal(expected_provider)
    assert result.platform_fee_amount + result.provider_amount == result.gross_amount


def test_split_rejects_zero_gross_amount():
    with pytest.raises(ValueError):
        SplitRequestDTO(gross_amount=Decimal("0"), platform_fee_percent=Decimal("10"))


def test_split_rejects_fee_over_100_percent():
    with pytest.raises(ValueError):
        SplitRequestDTO(gross_amount=Decimal("10"), platform_fee_percent=Decimal("101"))


def test_extract_payout_batch_id_from_response():
    response = {"batch_header": {"payout_batch_id": "QM8CHGYYVSG6C", "batch_status": "PENDING"}}
    assert _extract_payout_batch_id(response) == "QM8CHGYYVSG6C"


def test_extract_payout_batch_id_raises_on_missing_batch_header():
    with pytest.raises(PayPalToolError):
        _extract_payout_batch_id({})


def _make_service():
    paypal_repo = MagicMock()
    paypal_repo.create_payout.return_value = {
        "batch_header": {"payout_batch_id": "QM8CHGYYVSG6C", "batch_status": "PENDING"}
    }

    settlement_repo = AsyncMock()
    settlement_row = MagicMock(
        id="11111111-1111-1111-1111-111111111111",
        gross_amount=Decimal("100.00"),
        platform_fee_amount=Decimal("10.00"),
        provider_amount=Decimal("90.00"),
        status="pending",
        paypal_payout_batch_id=None,
    )
    settlement_repo.create.return_value = settlement_row

    audit_repo = AsyncMock()

    service = SettlementService(
        paypal_repo=paypal_repo, settlement_repo=settlement_repo, audit_repo=audit_repo
    )
    return service, paypal_repo, settlement_repo, settlement_row


async def test_create_and_payout_happy_path():
    service, paypal_repo, settlement_repo, settlement_row = _make_service()
    request = CreateSettlementRequestDTO(
        gross_amount=Decimal("100.00"),
        platform_fee_percent=Decimal("10"),
        recipient_email="provider@example.com",
        description="Freelance gig #42",
    )

    await service.create_and_payout(request)

    paypal_repo.create_payout.assert_called_once()
    _, kwargs = paypal_repo.create_payout.call_args
    # the PROVIDER's share is what gets paid out — not the gross amount,
    # and definitely not billed back to them (that was the bug this fixes)
    assert kwargs["recipient_email"] == "provider@example.com"
    assert kwargs["amount"] == Decimal("90.00")

    settlement_repo.mark_paid_out.assert_awaited_once_with(settlement_row, "QM8CHGYYVSG6C")
    settlement_repo.mark_failed.assert_not_called()
    settlement_repo.mark_payout_failed.assert_not_called()


async def test_create_and_payout_marks_failed_when_paypal_call_fails():
    service, paypal_repo, settlement_repo, settlement_row = _make_service()
    paypal_repo.create_payout.side_effect = PayPalToolError("sandbox is down")
    request = CreateSettlementRequestDTO(
        gross_amount=Decimal("50.00"),
        platform_fee_percent=Decimal("10"),
        recipient_email="provider@example.com",
        description="Freelance gig #43",
    )

    with pytest.raises(PayPalToolError):
        await service.create_and_payout(request)

    settlement_repo.mark_failed.assert_awaited_once_with(settlement_row)
    settlement_repo.mark_paid_out.assert_not_called()
