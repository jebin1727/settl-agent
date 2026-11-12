"""Global error handling.

Every error the app raises on purpose is a subclass of AppError, carries a
machine-readable `code`, and gets turned into the SAME JSON shape by the
handler registered in main.py:

    {"error": {"code": "...", "message": "...", "request_id": "..."}}

Unexpected exceptions (bugs) are caught by the catch-all handler, logged with
a full stack trace, and still return that same shape instead of leaking a
traceback to the client.
"""

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from src.core.logging import get_logger

logger = get_logger(__name__)


class AppError(Exception):
    code = "app_error"
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class NotFoundError(AppError):
    code = "not_found"
    status_code = status.HTTP_404_NOT_FOUND


class ValidationFailedError(AppError):
    code = "validation_failed"
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT


class PayPalToolError(AppError):
    """Raised when a PayPal Agent Toolkit call fails (sandbox outage, bad
    credentials, rejected operation)."""

    code = "paypal_tool_error"
    status_code = status.HTTP_502_BAD_GATEWAY


class LLMProviderError(AppError):
    """Raised when the configured LLM provider (Gemini or Ollama) fails or
    times out."""

    code = "llm_provider_error"
    status_code = status.HTTP_502_BAD_GATEWAY


class RateLimitedError(AppError):
    code = "rate_limited"
    status_code = status.HTTP_429_TOO_MANY_REQUESTS


def _error_body(request: Request, code: str, message: str) -> dict:
    request_id = request.headers.get("x-request-id", "-")
    return {"error": {"code": code, "message": message, "request_id": request_id}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError):
        logger.warning("app_error", code=exc.code, message=exc.message, path=request.url.path)
        return JSONResponse(status_code=exc.status_code, content=_error_body(request, exc.code, exc.message))

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception):
        logger.error("unhandled_exception", error=str(exc), path=request.url.path, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_body(request, "internal_error", "Something went wrong."),
        )
