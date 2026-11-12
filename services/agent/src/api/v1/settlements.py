"""Controller: HTTP in, DTO validation, delegates to the service, DTO out.
Zero business logic lives in this file — see SA-Arch.md §4."""

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import Settings, get_settings
from src.core.database import get_db_session
from src.core.rate_limit import limiter
from src.core.security import require_internal_token
from src.repositories.ledger_repository import AuditLogRepository, SettlementRepository
from src.repositories.paypal_repository import PayPalRepository
from src.schemas.settlement_dto import (
    CreateSettlementRequestDTO,
    SettlementResultDTO,
    SplitRequestDTO,
    SplitResultDTO,
)
from src.services import settlement_service
from src.services.settlement_service import SettlementService

router = APIRouter(prefix="/v1/settlements", tags=["settlements"], dependencies=[Depends(require_internal_token)])


def get_settlement_service(
    session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)
) -> SettlementService:
    return SettlementService(
        review_threshold=settings.guardian_review_threshold,
        paypal_repo=PayPalRepository(),
        settlement_repo=SettlementRepository(session),
        audit_repo=AuditLogRepository(session),
    )


@router.post("/calculate-split", response_model=SplitResultDTO)
async def calculate_split(request: SplitRequestDTO) -> SplitResultDTO:
    return settlement_service.calculate_split(request)


@router.post("", response_model=SettlementResultDTO)
@limiter.limit("20/minute")
async def create_settlement(
    request: Request,
    body: CreateSettlementRequestDTO,
    service: SettlementService = Depends(get_settlement_service),
) -> SettlementResultDTO:
    # Each call sends a REAL PayPal payout — rate-limited specifically to
    # prevent a bug or retry storm from actually paying someone repeatedly
    # or burning through PayPal sandbox call volume. See SA-Arch.md §10.
    return await service.create_and_payout(body)


@router.get("", response_model=list[SettlementResultDTO])
async def list_settlements(
    session: AsyncSession = Depends(get_db_session), limit: int = 50
) -> list[SettlementResultDTO]:
    rows = await SettlementRepository(session).list_recent(limit=limit)
    return [SettlementResultDTO.model_validate(row) for row in rows]


@router.post("/{settlement_id}/approve", response_model=SettlementResultDTO)
@limiter.limit("20/minute")
async def approve_settlement(
    request: Request,
    settlement_id: uuid.UUID,
    service: SettlementService = Depends(get_settlement_service),
) -> SettlementResultDTO:
    # Releases a Guardian-held settlement: the moment real PayPal money
    # actually moves, so rate-limited like create.
    return await service.approve(settlement_id)


@router.post("/{settlement_id}/reject", response_model=SettlementResultDTO)
@limiter.limit("20/minute")
async def reject_settlement(
    request: Request,
    settlement_id: uuid.UUID,
    service: SettlementService = Depends(get_settlement_service),
) -> SettlementResultDTO:
    return await service.reject(settlement_id)
