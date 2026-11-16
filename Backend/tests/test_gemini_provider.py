
from unittest.mock import Mock, patch

import httpx
import pytest

from app.services.gemini_provider import GeminiProvider


@pytest.fixture
def provider():
    return GeminiProvider(
        api_key="test-api-key",
        model="gemini-test-model",
        timeout_seconds=30,
    )


def mock_http_client(response=None, exception=None):
    client = Mock()

    if exception is not None:
        client.post.side_effect = exception
    else:
        client.post.return_value = response

    context_manager = Mock()
    context_manager.__enter__ = Mock(return_value=client)
    context_manager.__exit__ = Mock(return_value=False)

    return context_manager, client


def test_generate_returns_text(provider):
    response = Mock()
    response.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {"text": "Explicación generada"}
                    ]
                }
            }
        ]
    }

    context_manager, client = mock_http_client(response)

    with patch(
        "app.services.gemini_provider.httpx.Client",
        return_value=context_manager,
    ):
        result = provider.generate(
            system_prompt="Explica resultados ASG",
            user_prompt='{"score": 7.8}',
        )

    assert result == "Explicación generada"
    response.raise_for_status.assert_called_once()

    args, kwargs = client.post.call_args

    assert args[0].endswith(
        "/gemini-test-model:generateContent"
    )
    assert kwargs["headers"]["x-goog-api-key"] == "test-api-key"
    assert kwargs["json"]["systemInstruction"]["parts"][0]["text"] == (
        "Explica resultados ASG"
    )


def test_generate_rejects_empty_response(provider):
    response = Mock()
    response.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": "   "}]
                }
            }
        ]
    }

    context_manager, _ = mock_http_client(response)

    with patch(
        "app.services.gemini_provider.httpx.Client",
        return_value=context_manager,
    ):
        with pytest.raises(
            RuntimeError,
            match="empty explanation",
        ):
            provider.generate(
                system_prompt="System",
                user_prompt="User",
            )


def test_generate_handles_timeout(provider):
    context_manager, _ = mock_http_client(
        exception=httpx.TimeoutException("Timeout")
    )

    with patch(
        "app.services.gemini_provider.httpx.Client",
        return_value=context_manager,
    ):
        with pytest.raises(
            RuntimeError,
            match="timed out",
        ):
            provider.generate(
                system_prompt="System",
                user_prompt="User",
            )


def test_generate_handles_http_error(provider):
    request = httpx.Request(
        "POST",
        "https://example.com",
    )

    response = httpx.Response(
        status_code=429,
        request=request,
    )

    exception = httpx.HTTPStatusError(
        "Rate limit exceeded",
        request=request,
        response=response,
    )

    context_manager, _ = mock_http_client(
        exception=exception
    )

    with patch(
        "app.services.gemini_provider.httpx.Client",
        return_value=context_manager,
    ):
        with pytest.raises(
            RuntimeError,
            match="HTTP 429",
        ):
            provider.generate(
                system_prompt="System",
                user_prompt="User",
            )


def test_generate_rejects_invalid_structure(provider):
    response = Mock()
    response.json.return_value = {
        "candidates": []
    }

    context_manager, _ = mock_http_client(response)

    with patch(
        "app.services.gemini_provider.httpx.Client",
        return_value=context_manager,
    ):
        with pytest.raises(
            RuntimeError,
            match="Invalid Gemini response structure",
        ):
            provider.generate(
                system_prompt="System",
                user_prompt="User",
            )


@pytest.mark.parametrize(
    "api_key, model",
    [
        ("", "gemini-test-model"),
        ("test-api-key", ""),
    ],
)
def test_provider_requires_configuration(api_key, model):
    with pytest.raises(ValueError):
        GeminiProvider(
            api_key=api_key,
            model=model,
        )
