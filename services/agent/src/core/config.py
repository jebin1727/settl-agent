"""Typed, validated environment configuration.

Everything the app needs is declared here with a type. If a required value is
missing or malformed, this raises at import time — the app refuses to boot
instead of crashing confusingly on the first request that needs the value.
Nothing in this codebase should read `os.environ` directly outside this file.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

def _find_repo_root_env() -> Path | None:
    """The single root .env (SA-Arch.md §3) lives at the repo root, not
    inside services/agent — resolve it by walking up from this file's
    location (not CWD), so this works whether the service is launched from
    services/agent/ (local dev, alembic, pytest) or from anywhere else.

    Walks up rather than hardcoding a parents[N] index: the local layout is
    services/agent/src/core/config.py (repo root 4 levels up), but inside
    Docker this file lives at /app/src/core/config.py — a shallower path
    with no parents[4] at all, which raised IndexError and crash-looped the
    container until this was caught live. Inside Docker there's no root
    .env file regardless (docker-compose injects real env vars directly),
    so returning None there and falling back to os.environ is correct.
    """
    for parent in Path(__file__).resolve().parents:
        candidate = parent / ".env"
        if candidate.exists():
            return candidate
    return None


_REPO_ROOT_ENV = _find_repo_root_env()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_REPO_ROOT_ENV, extra="ignore")

    # service
    agent_port: int = Field(default=8000, alias="AGENT_PORT")
    log_level: str = Field(default="info", alias="LOG_LEVEL")
    # "console": colored, human-readable — for watching the agent work in a
    # terminal (the default, since that's what this project needs most).
    # "json": structured, one-line-per-event — for a real log aggregator.
    log_format: Literal["console", "json"] = Field(default="console", alias="LOG_FORMAT")
    agent_internal_token: str = Field(alias="AGENT_INTERNAL_TOKEN")

    # paypal
    paypal_client_id: str = Field(alias="PAYPAL_CLIENT_ID")
    paypal_client_secret: str = Field(alias="PAYPAL_CLIENT_SECRET")
    paypal_environment: Literal["SANDBOX", "PRODUCTION"] = Field(
        default="SANDBOX", alias="PAYPAL_ENVIRONMENT"
    )
    # Set once a webhook is registered in the PayPal dashboard (needs a
    # public HTTPS URL — not reachable from localhost without a tunnel).
    # Left blank, the webhook receiver still works end-to-end locally but
    # skips signature verification with a loud logged warning — see
    # api/v1/webhooks.py.
    paypal_webhook_id: str = Field(default="", alias="PAYPAL_WEBHOOK_ID")

    # llm
    llm_provider: Literal["gemini", "ollama"] = Field(default="gemini", alias="LLM_PROVIDER")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    ollama_base_url: str = Field(default="http://localhost:11434", alias="OLLAMA_BASE_URL")
    ollama_model: str = Field(default="qwen3:8b", alias="OLLAMA_MODEL")

    # infra
    database_url: str = Field(alias="DATABASE_URL")
    redis_url: str = Field(alias="REDIS_URL")
    rate_limit_per_minute: int = Field(default=60, alias="RATE_LIMIT_PER_MINUTE")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
