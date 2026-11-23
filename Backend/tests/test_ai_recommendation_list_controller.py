import pytest

from app.main import app
from app.core.config import settings
from app.core.roles import CompanyRole
from app.models.ai_recommendation_model import (
    AIRecommendation,
    AIRecommendationStatus,
)
from app.models.improvement_action_model import ImprovementPriority
from app.models.evaluation_model import EvaluationStatus
from app.services.token_service import get_current_user
from tests.test_evaluation_evidence import create_evidence_data


def prepare_recommendations(db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    evaluation.status = EvaluationStatus.COMPLETED

    recommendations = [
        AIRecommendation(
            evaluation_id=evaluation.id,
            indicator_id=None,
            gap_description="Brecha ambiental",
            title="Mejorar gestión energética",
            description="Registrar consumos",
            justification="Atiende la brecha ambiental",
            priority=ImprovementPriority.HIGH,
            status=AIRecommendationStatus.PENDING,
        ),
        AIRecommendation(
            evaluation_id=evaluation.id,
            indicator_id=None,
            gap_description="Brecha social",
            title="Fortalecer capacitación",
            description="Implementar capacitaciones",
            justification="Atiende la brecha social",
            priority=ImprovementPriority.MEDIUM,
            status=AIRecommendationStatus.REJECTED,
            reviewed_by=data["user"].id,
        ),
    ]

    db_session.add_all(recommendations)
    db_session.flush()

    return data, recommendations


def test_list_recommendations_returns_saved_proposals(
    client,
    db_session,
):
    data, recommendations = prepare_recommendations(db_session)

    app.dependency_overrides[get_current_user] = (
        lambda: data["user"]
    )

    try:
        response = client.get(
            f"/api/evaluations/{data['evaluation'].id}/ai-recommendations"
        )

        assert response.status_code == 200, response.text

        body = response.json()

        assert body["evaluation_id"] == data["evaluation"].id
        assert len(body["recommendations"]) == 2

        assert [
            item["id"] for item in body["recommendations"]
        ] == [
            recommendation.id for recommendation in recommendations
        ]

        assert [
            item["status"] for item in body["recommendations"]
        ] == ["PENDING", "REJECTED"]

        assert body["recommendations"][0]["improvement_action_id"] is None
        assert body["recommendations"][1]["reviewed_by"] == data["user"].id

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_list_recommendations_rejects_collaborator(
    client,
    db_session,
):
    data, _ = prepare_recommendations(db_session)

    data["membership"].role = CompanyRole.COLLABORATOR
    db_session.flush()

    app.dependency_overrides[get_current_user] = (
        lambda: data["user"]
    )

    try:
        response = client.get(
            f"/api/evaluations/{data['evaluation'].id}/ai-recommendations"
        )

        assert response.status_code == 403

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_list_recommendations_rejects_other_user(
    client,
    db_session,
):
    from app.models.user_model import User

    data, _ = prepare_recommendations(db_session)

    other_user = User(
        name="Other",
        lastname="User",
        email="other-recommendation-list@test.local",
        password="test-password",
        active=True,
    )

    db_session.add(other_user)
    db_session.flush()

    app.dependency_overrides[get_current_user] = (
        lambda: other_user
    )

    try:
        response = client.get(
            f"/api/evaluations/{data['evaluation'].id}/ai-recommendations"
        )

        assert response.status_code == 404

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_list_recommendations_works_with_ai_disabled(
    client,
    db_session,
    monkeypatch,
):
    monkeypatch.setattr(settings, "ai_enabled", False)

    data, _ = prepare_recommendations(db_session)

    app.dependency_overrides[get_current_user] = (
        lambda: data["user"]
    )

    try:
        response = client.get(
            f"/api/evaluations/{data['evaluation'].id}/ai-recommendations"
        )

        assert response.status_code == 200
        assert len(response.json()["recommendations"]) == 2

    finally:
        app.dependency_overrides.pop(get_current_user, None)
