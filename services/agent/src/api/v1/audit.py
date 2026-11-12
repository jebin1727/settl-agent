"""Controller: the dashboard's activity feed. Read-only — see SA-Arch.md §4."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db_session
from src.core.security import require_internal_token
from src.repositories.ledger_repository import AuditLogRepository
from src.schemas.audit_dto import AuditLogDTO

router = APIRouter(prefix="/v1/audit-logs", tags=["audit"], dependencies=[Depends(require_internal_token)])


@router.get("", response_model=list[AuditLogDTO])
async def list_audit_logs(
    session: AsyncSession = Depends(get_db_session), limit: int = 50
) -> list[AuditLogDTO]:
    rows = await AuditLogRepository(session).list_recent(limit=limit)
    return [AuditLogDTO.model_validate(row) for row in rows]
