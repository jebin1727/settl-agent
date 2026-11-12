"""Unit tests need a deterministic, isolated Settings instance — NOT
whatever `get_settings()`'s process-wide `@lru_cache` happened to resolve
first (which, once tests/integration exists, could be the real .env values,
since "integration" sorts before "unit" alphabetically and either directory
might import src.main first). FastAPI's dependency_overrides is the correct
tool here: it intercepts `Depends(get_settings)` everywhere, regardless of
import order or what's cached globally.
"""

from src.core.config import Settings, get_settings
from src.main import app

TEST_SETTINGS = Settings(
    AGENT_INTERNAL_TOKEN="test-token",
    PAYPAL_CLIENT_ID="test-client-id",
    PAYPAL_CLIENT_SECRET="test-client-secret",
    DATABASE_URL="postgresql+asyncpg://test:test@localhost:5432/test",
    REDIS_URL="redis://localhost:6379/0",
)

app.dependency_overrides[get_settings] = lambda: TEST_SETTINGS
