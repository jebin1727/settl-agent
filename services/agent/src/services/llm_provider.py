"""The Gemini ⇄ Ollama swap point. One function, driven entirely by
LLM_PROVIDER in .env. Gemini 2.5 Flash is the default for anything deployed
(hosted, consistent for judges). Ollama + qwen3:8b is for local dev so the
free Gemini quota isn't burned on every test run. Swapping providers never
requires touching any calling code — see SA-Arch.md §12.
"""

from langchain_core.language_models.chat_models import BaseChatModel

from src.core.config import Settings, get_settings
from src.core.errors import LLMProviderError
from src.core.logging import get_logger

logger = get_logger(__name__)


def get_llm(settings: Settings | None = None) -> BaseChatModel:
    settings = settings or get_settings()

    if settings.llm_provider == "gemini":
        if not settings.gemini_api_key:
            raise LLMProviderError("LLM_PROVIDER=gemini but GEMINI_API_KEY is not set.")
        from langchain_google_genai import ChatGoogleGenerativeAI

        logger.info("llm_provider_selected", provider="gemini", model="gemini-3.8-flash")
        return ChatGoogleGenerativeAI(
            model="gemini-3.8-flash",
            google_api_key=settings.gemini_api_key,
            temperature=0,
            # Default retry count backs off for minutes on a 429 (observed
            # 38-53s per attempt against the free tier), and since that
            # retry is synchronous even .ainvoke() only moves it off the
            # event loop thread — it doesn't make Gemini answer faster. The
            # token bucket above should prevent 429s before they happen;
            # this just bounds the damage when it doesn't.
            max_retries=1,
        )

    if settings.llm_provider == "ollama":
        from langchain_ollama import ChatOllama

        logger.info("llm_provider_selected", provider="ollama", model=settings.ollama_model)
        return ChatOllama(
            model=settings.ollama_model,
            base_url=settings.ollama_base_url,
            temperature=0,
        )

    raise LLMProviderError(f"Unknown LLM_PROVIDER: {settings.llm_provider}")
