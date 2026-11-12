"""FastAPI app factory. Mounts routers + middleware. No business logic lives
here — see src/services for that."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from src.api.v1 import audit, disputes, health, settlements, webhooks
from src.core.config import get_settings
from src.core.errors import register_exception_handlers
from src.core.logging import RequestIdMiddleware, configure_logging, get_logger
from src.core.rate_limit import limiter

settings = get_settings()
configure_logging(settings.log_level, settings.log_format)
logger = get_logger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(title="SettlAgent", version="0.1.0")

    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    app.add_middleware(RequestIdMiddleware)

    register_exception_handlers(app)

    app.include_router(health.router, prefix="")
    app.include_router(settlements.router)
    app.include_router(disputes.router)
    app.include_router(audit.router)
    app.include_router(webhooks.router)

    @app.exception_handler(RateLimitExceeded)
    async def handle_rate_limit(request: Request, exc: RateLimitExceeded) -> JSONResponse:
        # `raise exc` here (the bug this replaced) just re-threw the
        # exception instead of returning a response, so it fell through to
        # the catch-all handler as a generic 500 — caught by testing this
        # live, not in review. See Track.md.
        request_id = request.headers.get("x-request-id", "-")
        logger.warning("rate_limited", path=request.url.path, detail=exc.detail)
        return JSONResponse(
            status_code=429,
            content={"error": {"code": "rate_limited", "message": exc.detail, "request_id": request_id}},
        )

    logger.info("app_started", llm_provider=settings.llm_provider, paypal_env=settings.paypal_environment)
    return app


app = create_app()
