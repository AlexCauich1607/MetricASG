
from app.core.config import Settings
from app.services.gemini_provider import GeminiProvider
from app.services.llm_provider import LLMProvider


def create_llm_provider(settings: Settings) -> LLMProvider:
    """Construye el proveedor LLM según la configuración."""

    if not settings.ai_enabled:
        raise RuntimeError(
            "AI explanation generation is disabled"
        )

    provider_name = settings.ai_provider.strip().lower()

    if provider_name != "gemini":
        raise ValueError(
            "Unsupported AI provider"
        )

    return GeminiProvider(
        api_key=settings.ai_api_key,
        model=settings.ai_model,
        timeout_seconds=settings.ai_timeout_seconds,
    )
