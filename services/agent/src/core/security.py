"""Bearer-token auth for the internal API.

The Next.js app is the only intended caller, and it holds AGENT_INTERNAL_TOKEN
server-side (never shipped to the browser — see apps/web/src/app/api/*).
This is intentionally simple: no OAuth dance, no mTLS. For a hackathon-scale
internal service behind one trusted caller, a shared bearer token over TLS is
the right amount of security, not the maximum possible amount.
"""

from fastapi import Depends, Header

from src.core.config import Settings, get_settings
from src.core.errors import AppError
from fastapi import status


class UnauthorizedError(AppError):
    code = "unauthorized"
    status_code = status.HTTP_401_UNAUTHORIZED


async def require_internal_token(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    expected = f"Bearer {settings.agent_internal_token}"
    if not authorization or authorization != expected:
        raise UnauthorizedError("Missing or invalid bearer token.")
