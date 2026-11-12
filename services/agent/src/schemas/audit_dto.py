import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditLogDTO(BaseModel):
    """The dashboard's activity feed reads this — every meaningful action
    any service took, in order, with its full detail payload (not just a
    status badge). See models/audit_log.py and SA-Arch.md §9."""

    id: uuid.UUID
    request_id: str
    actor: str
    action: str
    details: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}
