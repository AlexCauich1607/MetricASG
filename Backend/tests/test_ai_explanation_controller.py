
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.main import app
from app.services.token_service import get_current_user


BASE_URL = "/api/evaluations/10/ai-explanation"


@pytest.fixture
def authenticated_user():
    user = SimpleNamespace(id=5)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        yield user
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_ai_explanation_requires_authentication(client):
    response = client.post(BASE_URL)

    assert response.status_code == 401


def test_ai_explanation_returns_generated_text(
    client,
    authenticated_user,
    monkeypatch,
):
    monkeypatch.setattr(settings, "ai_enabled", True)

    context = Mock()
    context.model_dump_json.return_value = '{"evaluation":{"id":10}}'

    provider = Mock()
    provider.generate.return_value = (
        "La evaluación presenta una puntuación global de 7.8."
    )

    with (
        patch(
            "app.controllers.evaluation_controller."
            "AIExplanationContextService"
        ) as context_service,
        patch(
            "app.controllers.evaluation_controller."
            "create_llm_provider",
            return_value=provider,
        ) as provider_factory,
    ):
        context_service.return_value.build_context.return_value = context

        response = client.post(BASE_URL)

        assert response.status_code == 200, response.text
        assert response.json() == {
            "evaluation_id": 10,
            "explanation": (
                "La evaluación presenta una puntuación global de 7.8."
            ),
            "generated_by_ai": True,
        }

        context_service.return_value.build_context.assert_called_once_with(
            evaluation_id=10,
            user_id=authenticated_user.id,
        )
        provider_factory.assert_called_once()

        provider.generate.assert_called_once()


def test_ai_explanation_rejects_unauthorized_evaluation(
    client,
    authenticated_user,
    monkeypatch,
):
    monkeypatch.setattr(settings, "ai_enabled", True)

    with (
        patch(
            "app.controllers.evaluation_controller."
            "AIExplanationContextService"
        ) as context_service,
        patch(
            "app.controllers.evaluation_controller."
            "create_llm_provider"
        ) as provider_factory,
    ):
        context_service.return_value.build_context.side_effect = (
            HTTPException(
                status_code=404,
                detail="Evaluation not found",
            )
        )

        response = client.post(BASE_URL)

        assert response.status_code == 404
        provider_factory.assert_not_called()


def test_ai_explanation_rejects_disabled_ai(
    client,
    authenticated_user,
    monkeypatch,
):
    monkeypatch.setattr(settings, "ai_enabled", False)

    with patch(
        "app.controllers.evaluation_controller."
        "AIExplanationContextService"
    ) as context_service:
        response = client.post(BASE_URL)

        assert response.status_code == 503
        assert response.json()["detail"] == (
            "AI explanations are not available"
        )

        context_service.assert_not_called()


def test_ai_explanation_handles_provider_error(
    client,
    authenticated_user,
    monkeypatch,
):
    monkeypatch.setattr(settings, "ai_enabled", True)

    context = Mock()
    context.model_dump_json.return_value = "{}"

    provider = Mock()
    provider.generate.side_effect = RuntimeError(
        "Gemini API returned HTTP 429"
    )

    with (
        patch(
            "app.controllers.evaluation_controller."
            "AIExplanationContextService"
        ) as context_service,
        patch(
            "app.controllers.evaluation_controller."
            "create_llm_provider",
            return_value=provider,
        ),
    ):
        context_service.return_value.build_context.return_value = context

        response = client.post(BASE_URL)

        assert response.status_code == 503
        assert response.json()["detail"] == (
            "AI explanation generation is temporarily unavailable"
        )

        assert "429" not in response.text
