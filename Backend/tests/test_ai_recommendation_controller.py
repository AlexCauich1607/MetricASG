
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

from app.core.config import settings
from app.main import app
from app.models.ai_recommendation_model import (
    AIRecommendationStatus,
)
from app.models.improvement_action_model import ImprovementPriority
from app.services.token_service import get_current_user
from fastapi import HTTPException

from app.core.roles import CompanyRole
from tests.test_evaluation_evidence import create_evidence_data

BASE_URL = "/api/evaluations/10/ai-recommendations"


@pytest.fixture
def authenticated_user():
    user = SimpleNamespace(id=5)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        yield user
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_ai_recommendations_requires_authentication(client):
    response = client.post(BASE_URL)

    assert response.status_code == 401


def test_ai_recommendations_rejects_disabled_ai(
    client,
    authenticated_user,
    monkeypatch,
):
    monkeypatch.setattr(settings, "ai_enabled", False)

    with patch(
        "app.controllers.evaluation_controller."
        "create_llm_provider"
    ) as provider_factory:
        response = client.post(BASE_URL)

    assert response.status_code == 503
    assert response.json()["detail"] == (
        "AI recommendations are not available"
    )

    provider_factory.assert_not_called()


def test_ai_recommendations_returns_pending_proposals(
    client,
    authenticated_user,
    monkeypatch,
):
    monkeypatch.setattr(settings, "ai_enabled", True)

    context = Mock()
    context.model_dump_json.return_value = (
        '{"evaluation":{"id":10}}'
    )

    provider = Mock()
    provider.generate.return_value = (
        '{"recommendations":[]}'
    )

    validated_response = Mock()

    recommendation = SimpleNamespace(
        id=25,
        indicator_id=None,
        gap_description="Falta seguimiento energético",
        title="Monitoreo energético",
        description="Registrar consumos mensuales",
        justification="Atiende una brecha ambiental",
        priority=ImprovementPriority.HIGH,
        status=AIRecommendationStatus.PENDING,
    )

    evaluation = SimpleNamespace(
        id=10,
        company_id=7,
    )

    with (
        patch(
            "app.controllers.evaluation_controller."
            "ImprovementActionService"
        ) as action_service,
        patch(
            "app.controllers.evaluation_controller."
            "require_company_role"
        ) as require_role,
        patch(
            "app.controllers.evaluation_controller."
            "AIRecommendationContextService"
        ) as context_service,
        patch(
            "app.controllers.evaluation_controller."
            "create_llm_provider",
            return_value=provider,
        ) as provider_factory,
        patch(
            "app.controllers.evaluation_controller."
            "AIRecommendationValidationService"
        ) as validation_service,
        patch(
            "app.controllers.evaluation_controller."
            "AIRecommendationPersistenceService"
        ) as persistence_service,
    ):
        action_service.return_value.get_evaluation_or_error.return_value = (
            evaluation
        )
        context_service.return_value.build_context.return_value = (
            context
        )
        validation_service.return_value.validate.return_value = (
            validated_response
        )
        persistence_service.return_value.save_recommendations.return_value = (
            [recommendation]
        )

        response = client.post(BASE_URL)

        assert response.status_code == 200, response.text

        assert response.json() == {
            "evaluation_id": 10,
            "generated_by_ai": True,
            "requires_human_approval": True,
            "recommendations": [
                {
                    "id": 25,
                    "indicator_id": None,
                    "gap_description": "Falta seguimiento energético",
                    "title": "Monitoreo energético",
                    "description": "Registrar consumos mensuales",
                    "justification": "Atiende una brecha ambiental",
                    "priority": "HIGH",
                    "status": "PENDING",
                }
            ],
        }

        action_service.return_value.get_evaluation_or_error.assert_called_once_with(
            evaluation_id=10,
            user_id=authenticated_user.id,
        )

        action_service.return_value.validate_evaluation_completed.assert_called_once_with(
            evaluation
        )

        require_role.assert_called_once()

        context_service.return_value.build_context.assert_called_once_with(
            evaluation_id=10,
            user_id=authenticated_user.id,
        )

        provider_factory.assert_called_once()
        provider.generate.assert_called_once()

        validation_service.return_value.validate.assert_called_once_with(
            raw_response='{"recommendations":[]}',
            context=context,
        )

        persistence_service.return_value.save_recommendations.assert_called_once_with(
            evaluation_id=10,
            user_id=authenticated_user.id,
            context=context,
            response=validated_response,
        )

def test_ai_recommendations_handles_provider_error(
    client,
    authenticated_user,
    monkeypatch,
):
    monkeypatch.setattr(settings, "ai_enabled", True)

    evaluation = SimpleNamespace(id=10, company_id=7)

    with (
        patch(
            "app.controllers.evaluation_controller."
            "ImprovementActionService"
        ) as action_service,
        patch(
            "app.controllers.evaluation_controller."
            "require_company_role"
        ),
        patch(
            "app.controllers.evaluation_controller."
            "AIRecommendationContextService"
        ) as context_service,
        patch(
            "app.controllers.evaluation_controller."
            "create_llm_provider",
            side_effect=RuntimeError("Provider API key unavailable"),
        ),
        patch(
            "app.controllers.evaluation_controller."
            "AIRecommendationPersistenceService"
        ) as persistence_service,
    ):
        action_service.return_value.get_evaluation_or_error.return_value = (
            evaluation
        )
        context_service.return_value.build_context.return_value = Mock()

        response = client.post(BASE_URL)

        assert response.status_code == 503
        assert response.json()["detail"] == (
            "AI recommendation generation "
            "is temporarily unavailable"
        )

        assert "API key" not in response.text
        persistence_service.assert_not_called()


def test_ai_recommendations_rejects_invalid_llm_response(
    client,
    authenticated_user,
    monkeypatch,
):
    monkeypatch.setattr(settings, "ai_enabled", True)

    evaluation = SimpleNamespace(id=10, company_id=7)

    provider = Mock()
    provider.generate.return_value = '{"recommendations":"invalid"}'

    with (
        patch(
            "app.controllers.evaluation_controller."
            "ImprovementActionService"
        ) as action_service,
        patch(
            "app.controllers.evaluation_controller."
            "require_company_role"
        ),
        patch(
            "app.controllers.evaluation_controller."
            "AIRecommendationContextService"
        ) as context_service,
        patch(
            "app.controllers.evaluation_controller."
            "create_llm_provider",
            return_value=provider,
        ),
        patch(
            "app.controllers.evaluation_controller."
            "AIRecommendationValidationService"
        ) as validation_service,
        patch(
            "app.controllers.evaluation_controller."
            "AIRecommendationPersistenceService"
        ) as persistence_service,
    ):
        action_service.return_value.get_evaluation_or_error.return_value = (
            evaluation
        )

        context_service.return_value.build_context.return_value = Mock()

        validation_service.return_value.validate.side_effect = HTTPException(
            status_code=422,
            detail="Invalid AI recommendation response",
        )

        response = client.post(BASE_URL)

        assert response.status_code == 422
        persistence_service.assert_not_called()


def test_ai_recommendations_rejects_collaborator(
    client,
    db_session,
    monkeypatch,
):
    monkeypatch.setattr(settings, "ai_enabled", True)

    data = create_evidence_data(db_session)

    data["membership"].role = CompanyRole.COLLABORATOR
    db_session.flush()

    evaluation_id = data["evaluation"].id

    app.dependency_overrides[get_current_user] = (
        lambda: data["user"]
    )

    try:
        with patch(
            "app.controllers.evaluation_controller."
            "create_llm_provider"
        ) as provider_factory:
            response = client.post(
                f"/api/evaluations/{evaluation_id}/ai-recommendations"
            )

        assert response.status_code == 403
        provider_factory.assert_not_called()

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )
