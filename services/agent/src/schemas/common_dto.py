"""Shared DTOs. See SA-Arch.md §4/§8 for why DTOs are kept separate from
SQLAlchemy models (models/) — the API contract should not change just because
the DB schema does."""

from pydantic import BaseModel


class ErrorDTO(BaseModel):
    code: str
    message: str
    request_id: str
