from arq.connections import RedisSettings

from src.core.config import get_settings
from src.core.logging import configure_logging, get_logger
from src.workers.tasks import ping, triage_dispute_job

settings = get_settings()
# The worker is its own process — main.py's configure_logging() call never
# runs here, so without this the worker's log lines were unformatted/raw.
# Caught while building the webhook path, since this is the first time the
# worker had a real job worth watching run.
configure_logging(settings.log_level, settings.log_format)
logger = get_logger(__name__)


class WorkerSettings:
    functions = [ping, triage_dispute_job]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)

    @staticmethod
    async def on_startup(ctx):
        logger.info("worker_started", llm_provider=settings.llm_provider)
