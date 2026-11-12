"""Business logic for settlements: the pure split calculation (no HTTP, no
DB, no PayPal — trivial to unit test, see tests/unit/test_settlement_service.py)
plus the full create-and-payout flow, which DOES touch the repositories.
See SA-Arch.md §4 for the traced Controller→Service→Repository→DTO example.

This used to invoice the provider — i.e. bill THEM for THEIR OWN earnings,
backwards from what "settling a job" means. Fixed to actually pay them via
PayPal Payouts. See Track.md for the full story of why.

Every settlement now passes through the Payment Guardian (services/
guardian.py) BEFORE any money moves.
"""

import uuid
from decimal import ROUND_HALF_UP, Decimal

from src.core.errors import NotFoundError, PayPalToolError, ValidationFailedError
from src.core.logging import get_logger, get_request_id
from src.repositories.ledger_repository import AuditLogRepository, SettlementRepository
from src.repositories.paypal_repository import PayPalRepository
from src.schemas.settlement_dto import (
    CreateSettlementRequestDTO,
    SettlementResultDTO,
    SplitRequestDTO,
    SplitResultDTO,
)
from src.services.guardian import PriorSettlement, assess_settlement

logger = get_logger(__name__)


def calculate_split(request: SplitRequestDTO) -> SplitResultDTO:
    fee_fraction = request.platform_fee_percent / Decimal(100)
    platform_fee_amount = (request.gross_amount * fee_fraction).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    provider_amount = request.gross_amount - platform_fee_amount

    return SplitResultDTO(
        gross_amount=request.gross_amount,
        platform_fee_amount=platform_fee_amount,
        provider_amount=provider_amount,
    )


def _extract_payout_batch_id(create_payout_response: dict) -> str:
    """PayPal's Payouts response nests the batch ID under batch_header —
    e.g. {"batch_header": {"payout_batch_id": "QM8CHGYYVSG6C", ...}}."""
    batch_id = create_payout_response.get("batch_header", {}).get("payout_batch_id")
    if not batch_id:
        raise PayPalToolError(f"Could not extract payout batch ID from PayPal response: {create_payout_response}")
    return batch_id


class SettlementService:
    def __init__(
        self,
        paypal_repo: PayPalRepository,
        settlement_repo: SettlementRepository,
        audit_repo: AuditLogRepository,
        review_threshold: Decimal = Decimal("500"),
    ):
        self._paypal = paypal_repo
        self._settlements = settlement_repo
        self._audit = audit_repo
        self._review_threshold = review_threshold

    async def create_and_payout(self, request: CreateSettlementRequestDTO) -> SettlementResultDTO:
        """Split, then let the Payment Guardian assess BEFORE any money
        moves: clean settlements are paid out immediately; flagged ones are
        held as awaiting_approval until a human approves (see approve())."""
        split = calculate_split(
            SplitRequestDTO(
                gross_amount=request.gross_amount, platform_fee_percent=request.platform_fee_percent
            )
        )
        history = [
            PriorSettlement(row.gross_amount, row.recipient_email, row.created_at)
            for row in await self._settlements.list_recent(limit=200)
        ]
        assessment = assess_settlement(
            gross_amount=split.gross_amount,
            fee_percent=request.platform_fee_percent,
            recipient_email=str(request.recipient_email),
            history=history,
            review_threshold=self._review_threshold,
        )

        settlement = await self._settlements.create(
            split.gross_amount,
            split.platform_fee_amount,
            split.provider_amount,
            recipient_email=str(request.recipient_email),
            description=request.description,
            risk_score=assessment.score,
            risk_flags=assessment.flags,
            status="awaiting_approval" if assessment.hold else "pending",
        )
        await self._audit.record(
            request_id=get_request_id(),
            actor="settlement_service",
            action="settlement_created",
            details={
                "settlement_id": str(settlement.id),
                "gross_amount": str(split.gross_amount),
                "platform_fee_amount": str(split.platform_fee_amount),
                "provider_amount": str(split.provider_amount),
                "description": request.description,
            },
        )
        await self._audit.record(
            request_id=get_request_id(),
            actor="payment_guardian",
            action="guardian_assessed",
            details={
                "settlement_id": str(settlement.id),
                "risk_score": float(assessment.score),
                "flags": assessment.flags,
                "decision": "hold_for_approval" if assessment.hold else "auto_approve",
            },
        )

        if assessment.hold:
            logger.info("settlement_held_for_approval", settlement_id=str(settlement.id))
            return SettlementResultDTO.model_validate(settlement)

        return await self._execute_payout(settlement)

    async def approve(self, settlement_id: uuid.UUID) -> SettlementResultDTO:
        settlement = await self._require_awaiting(settlement_id)
        await self._audit.record(
            request_id=get_request_id(),
            actor="human_operator",
            action="settlement_approved",
            details={"settlement_id": str(settlement.id), "risk_score": float(settlement.risk_score or 0)},
        )
        return await self._execute_payout(settlement)

    async def reject(self, settlement_id: uuid.UUID) -> SettlementResultDTO:
        settlement = await self._require_awaiting(settlement_id)
        await self._settlements.mark_status(settlement, "rejected")
        await self._audit.record(
            request_id=get_request_id(),
            actor="human_operator",
            action="settlement_rejected",
            details={"settlement_id": str(settlement.id)},
        )
        return SettlementResultDTO.model_validate(settlement)

    async def _require_awaiting(self, settlement_id: uuid.UUID):
        settlement = await self._settlements.get(settlement_id)
        if settlement is None:
            raise NotFoundError(f"Settlement {settlement_id} not found.")
        if settlement.status != "awaiting_approval":
            raise ValidationFailedError(
                f"Settlement is '{settlement.status}'; only 'awaiting_approval' can be approved or rejected."
            )
        return settlement

    async def _execute_payout(self, settlement) -> SettlementResultDTO:
        try:
            payout_response = self._paypal.create_payout(
                recipient_email=settlement.recipient_email,
                amount=settlement.provider_amount,
                currency_code="USD",
                note=f"SettlAgent settlement: {settlement.description}",
                sender_batch_id=f"settlagent-{settlement.id}",
            )
        except PayPalToolError as exc:
            await self._settlements.mark_failed(settlement)
            logger.error("settlement_payout_failed", settlement_id=str(settlement.id))
            await self._audit.record(
                request_id=get_request_id(),
                actor="settlement_service",
                action="payout_failed",
                details={"settlement_id": str(settlement.id), "error": str(exc)},
            )
            raise

        batch_id = _extract_payout_batch_id(payout_response)
        batch_status = payout_response.get("batch_header", {}).get("batch_status", "UNKNOWN")

        await self._settlements.mark_paid_out(settlement, batch_id)
        logger.info(
            "settlement_paid_out",
            settlement_id=str(settlement.id),
            payout_batch_id=batch_id,
            batch_status=batch_status,
        )
        await self._audit.record(
            request_id=get_request_id(),
            actor="settlement_service",
            action="payout_sent",
            details={
                "settlement_id": str(settlement.id),
                "payout_batch_id": batch_id,
                "batch_status": batch_status,
                "provider_amount": str(settlement.provider_amount),
            },
        )
        return SettlementResultDTO.model_validate(settlement)
