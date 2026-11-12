"""Structured JSON logging with per-request correlation IDs.

No module in this codebase should call `print()`. Import `get_logger(__name__)`
instead. Every log line emitted during a request carries that request's ID
(bound by RequestIdMiddleware below), so a single ID can be grepped to see the
complete trace of what the agent did for that request.
"""

import logging
import sys
import uuid
from contextvars import ContextVar

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp

_request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")


def _add_request_id(_, __, event_dict):
    event_dict["request_id"] = _request_id_ctx.get()
    return event_dict


class _SuppressPollingAccessLogs(logging.Filter):
    """Uvicorn's access logger (not ours — this is the "INFO: 127.0.0.1:xxxx
    - GET /healthz 200 OK" lines) was drowning out every real agent event:
    the dashboard polls /healthz and /v1/* list endpoints every 10s, so by
    volume almost nothing in the terminal was actually the agent doing
    something. This filter drops only the polling noise; everything else
    (actual errors, non-GET requests, anything not in the quiet list) still
    logs normally."""

    QUIET_PATHS = ("/healthz", "/readyz")

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        return not any(f'"GET {path} ' in message for path in self.QUIET_PATHS)


def configure_logging(log_level: str = "info", log_format: str = "console") -> None:
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level.upper(),
    )
    logging.getLogger("uvicorn.access").addFilter(_SuppressPollingAccessLogs())

    renderer = (
        structlog.dev.ConsoleRenderer(colors=True)
        if log_format == "console"
        else structlog.processors.JSONRenderer()
    )

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            _add_request_id,
            structlog.processors.TimeStamper(fmt="%H:%M:%S" if log_format == "console" else "iso"),
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(log_level.upper())),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str):
    return structlog.get_logger(name)


def get_request_id() -> str:
    """The current request's ID, for anything that needs to tag a durable
    record with it (AuditLogRepository in particular) — not just log lines.
    Returns "-" outside a request context (e.g. a script, a worker job not
    tied to an HTTP request)."""
    return _request_id_ctx.get()


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Generates a request ID, binds it to every log line emitted while this
    request is in flight, and echoes it back as a response header so the
    frontend/user can correlate a UI action with server-side logs."""

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        token = _request_id_ctx.set(request_id)
        try:
            response = await call_next(request)
        finally:
            _request_id_ctx.reset(token)
        response.headers["x-request-id"] = request_id
        return response
