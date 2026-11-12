from decimal import Decimal

from src.repositories.ledger_repository import AuditLogRepository, DisputeRepository, SettlementRepository


async def test_settlement_create_and_get(db_session):
    repo = SettlementRepository(db_session)

    settlement = await repo.create(
        gross_amount=Decimal("100.00"),
        platform_fee_amount=Decimal("10.00"),
        provider_amount=Decimal("90.00"),
    )

    fetched = await repo.get(settlement.id)
    assert fetched is not None
    assert fetched.gross_amount == Decimal("100.00")
    assert fetched.status == "pending"


async def test_settlement_paid_out_lifecycle(db_session):
    repo = SettlementRepository(db_session)
    settlement = await repo.create(Decimal("100.00"), Decimal("10.00"), Decimal("90.00"))

    await repo.mark_paid_out(settlement, "QM8REAL0001")
    done = await repo.get(settlement.id)
    assert done.status == "paid_out"
    assert done.paypal_payout_batch_id == "QM8REAL0001"


async def test_settlement_payout_failed_keeps_batch_id_when_provided(db_session):
    """The real bug class this guards against (same shape as the earlier
    invoice-send-failed bug): a settlement whose payout batch WAS accepted
    by PayPal but later reported as unsuccessful must not look like
    nothing happened — the batch ID stays attached."""
    repo = SettlementRepository(db_session)
    settlement = await repo.create(Decimal("50.00"), Decimal("5.00"), Decimal("45.00"))

    await repo.mark_payout_failed(settlement, "QM8REAL0002")

    result = await repo.get(settlement.id)
    assert result.status == "payout_failed"
    assert result.paypal_payout_batch_id == "QM8REAL0002"


async def test_settlement_list_recent_orders_newest_first(db_session):
    repo = SettlementRepository(db_session)
    first = await repo.create(Decimal("10.00"), Decimal("1.00"), Decimal("9.00"))
    second = await repo.create(Decimal("20.00"), Decimal("2.00"), Decimal("18.00"))

    recent = await repo.list_recent(limit=10)

    ids = [s.id for s in recent]
    assert ids.index(second.id) < ids.index(first.id)


async def test_dispute_upsert_is_idempotent(db_session):
    repo = DisputeRepository(db_session)

    first = await repo.upsert_from_paypal("PP-DISPUTE-1", settlement_id=None)
    second = await repo.upsert_from_paypal("PP-DISPUTE-1", settlement_id=None)

    assert first.id == second.id


async def test_dispute_record_decision_persists_rationale(db_session):
    repo = DisputeRepository(db_session)
    dispute = await repo.upsert_from_paypal("PP-DISPUTE-2", settlement_id=None)

    resolved = await repo.record_decision(
        dispute,
        risk_score=Decimal("0.120"),
        decision="accept_claim",
        rationale="Low amount, first-time buyer complaint, auto-approved under threshold.",
        status="auto_resolved",
    )

    assert resolved.status == "auto_resolved"
    assert resolved.decision == "accept_claim"
    assert "auto-approved" in resolved.rationale


async def test_audit_log_records_structured_details(db_session):
    repo = AuditLogRepository(db_session)

    entry = await repo.record(
        request_id="test-request-id",
        actor="dispute_service",
        action="risk_classified",
        details={"risk_score": 0.12, "model": "gemini-3.8-flash"},
    )

    assert entry.details["model"] == "gemini-3.8-flash"

    recent = await repo.list_recent(limit=10)
    assert any(e.id == entry.id for e in recent)
