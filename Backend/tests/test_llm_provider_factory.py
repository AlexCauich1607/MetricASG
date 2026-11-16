
from types import SimpleNamespace

import pytest

from app.services.gemini_provider import GeminiProvider
from app.services.llm_provider_factory import create_llm_provider


def build_settings(**overrides):
    values = {
        "ai_enabled": True,
        "ai_provider": "gemini",
        "ai_model": "gemini-test-model",
        "ai_api_key": "test-api-key",
        "ai_timeout_seconds": 30,
    }

    values.update(overrides)

    return SimpleNamespace(**values)


def test_creates_gemini_provider():
    settings = build_settings()

    provider = create_llm_provider(settings)

    assert isinstance(provider, GeminiProvider)
    assert provider.model == "gemini-test-model"
    assert provider.timeout_seconds == 30


def test_rejects_disabled_ai():
    settings = build_settings(ai_enabled=False)

    with pytest.raises(
        RuntimeError,
        match="AI explanation generation is disabled",
    ):
        create_llm_provider(settings)


def test_rejects_unsupported_provider():
    settings = build_settings(ai_provider="unsupported")

    with pytest.raises(
        ValueError,
        match="Unsupported AI provider",
    ):
        create_llm_provider(settings)


@pytest.mark.parametrize(
    "overrides",
    [
        {"ai_api_key": ""},
        {"ai_model": ""},
        {"ai_timeout_seconds": 0},
        {"ai_timeout_seconds": 121},
    ],
)
def test_rejects_invalid_gemini_configuration(overrides):
    settings = build_settings(**overrides)

    with pytest.raises(ValueError):
        create_llm_provider(settings)


def test_accepts_case_insensitive_provider():
    settings = build_settings(ai_provider="GEMINI")

    provider = create_llm_provider(settings)

    assert isinstance(provider, GeminiProvider)
