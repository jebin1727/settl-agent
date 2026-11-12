"""The Payment Guardian's rules, exhaustively — it gates real payouts."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from src.services.guardian import PriorSettlement, assess_settlement

NOW = datetime(2026, 11, 12, 12, 0, tzinfo=timezone.utc)
LIMIT = Decimal("500")


def _assess(gross="100", fee="10", email="a@x.com", history=None):
    return assess_settlement(
        gross_amount=Decimal(gross),
        fee_percent=Decimal(fee),
        recipient_email=email,
        history=history or [],
        review_threshold=LIMIT,
        now=NOW,
    )


def _prior(amount="100", email="a@x.com", minutes_ago=600):
    return PriorSettlement(Decimal(amount), email, NOW - timedelta(minutes=minutes_ago))


def test_clean_settlement_is_auto_approved():
    result = _assess()
    assert result.flags == [] and result.score == 0 and not result.hold


def test_large_amount_holds():
    result = _assess(gross="500")
    assert [f["rule"] for f in result.flags] == ["LARGE_AMOUNT"]
    assert result.hold


def test_amount_anomaly_needs_enough_history():
    assert not _assess(gross="400", history=[_prior("100"), _prior("100")]).flags
    result = _assess(gross="400", history=[_prior("100"), _prior("100"), _prior("120")])
    assert "AMOUNT_ANOMALY" in [f["rule"] for f in result.flags]


def test_velocity_flags_repeated_recent_payouts():
    history = [_prior(minutes_ago=5), _prior(minutes_ago=20), _prior(minutes_ago=40)]
    assert "VELOCITY" in [f["rule"] for f in _assess(history=history).flags]


def test_old_payouts_do_not_count_toward_velocity():
    history = [_prior(minutes_ago=300)] * 3
    assert "VELOCITY" not in [f["rule"] for f in _assess(history=history).flags]


def test_high_fee_flag_alone_holds():
    result = _assess(fee="45")
    assert [f["rule"] for f in result.flags] == ["HIGH_FEE"]
    assert result.hold


def test_new_recipient_alone_is_noted_but_not_held():
    result = _assess(email="stranger@x.com", history=[_prior(email="a@x.com")])
    assert [f["rule"] for f in result.flags] == ["NEW_RECIPIENT"]
    assert not result.hold


def test_new_recipient_not_flagged_when_no_recipient_book_exists():
    assert not _assess(history=[PriorSettlement(Decimal("50"), None, NOW)]).flags


def test_score_is_capped_at_one():
    history = [_prior("10", minutes_ago=5)] * 3 + [_prior("10", email="z@x.com")]
    result = _assess(gross="900", fee="50", email="a@x.com", history=history)
    assert result.score <= 1
