"""Controller: HTTP in, DTO validation, delegates to the service, DTO out.
Zero business logic here — see SA-Arch.md §4."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db_session
from src.core.rate_limit import limiter
from src.core.security import require_internal_token
from src.repositories.ledger_repository import AuditLogRepository, DisputeRepository
from src.repositories.paypal_repository import PayPalRepository
from src.schemas.dispute_dto import DisputeSummaryDTO, DisputeTriageResultDTO, SimulateDisputeRequestDTO
from src.services.dispute_service import DisputeService

router = APIRouter(prefix="/v1/disputes", tags=["disputes"], dependencies=[Depends(require_internal_token)])


def get_dispute_service(session: AsyncSession = Depends(get_db_session)) -> DisputeService:
    return DisputeService(
        paypal_repo=PayPalRepository(),
        dispute_repo=DisputeRepository(session),
        audit_repo=AuditLogRepository(session),
    )


@router.post("/{dispute_id}/triage", response_model=DisputeTriageResultDTO)
@limiter.limit("15/minute")
async def triage_dispute(
    request: Request, dispute_id: str, service: DisputeService = Depends(get_dispute_service)
) -> DisputeTriageResultDTO:
    # This is the route that calls Gemini — inbound limit here is a second
    # line of defense in front of the outbound token bucket in
    # dispute_service.py, which protects the free-tier quota specifically.
    # See SA-Arch.md §10 on why these are two different concerns.
    return await service.triage(dispute_id)


@router.post("/simulate", response_model=DisputeTriageResultDTO)
@limiter.limit("15/minute")
async def simulate_dispute(
    request: Request,
    body: SimulateDisputeRequestDTO,
    service: DisputeService = Depends(get_dispute_service),
) -> DisputeTriageResultDTO:
    # Demo-safe path — real LLM reasoning and decision logic, synthetic
    # input, no PayPal mutation. See DisputeService.simulate().
    return await service.simulate(body)


@router.get("", response_model=list[DisputeSummaryDTO])
async def list_disputes(
    session: AsyncSession = Depends(get_db_session), limit: int = 50
) -> list[DisputeSummaryDTO]:
    rows = await DisputeRepository(session).list_recent(limit=limit)
    return [DisputeSummaryDTO.model_validate(row) for row in rows]
