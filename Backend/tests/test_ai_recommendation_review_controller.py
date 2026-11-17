import pytest
from app.core.roles import CompanyRole
from datetime import date

from app.core.config import settings
from app.main import app
from app.models.ai_recommendation_model import (
    AIRecommendation,
    AIRecommendationStatus,
)
from app.models.evaluation_model import EvaluationStatus
from app.models.improvement_action_model import (
    ImprovementAction,
    ImprovementPriority,
)
from app.services.token_service import get_current_user
from tests.test_evaluation_evidence import create_evidence_data
from app.models.audit_log_model import AuditLog
from unittest.mock import patch

import pytest
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.services.audit_service import AuditService

def prepare_recommendation(db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    evaluation.status = EvaluationStatus.COMPLETED

    recommendation = AIRecommendation(
        evaluation_id=evaluation.id,
        indicator_id=None,
        gap_description="Falta seguimiento energético",
        title="Implementar monitoreo energético",
        description="Registrar consumos mensuales",
        justification="Atiende una brecha ambiental",
        priority=ImprovementPriority.HIGH,
        status=AIRecommendationStatus.PENDING,
    )

    db_session.add(recommendation)
    db_session.flush()

    return data, recommendation


def test_accept_recommendation_with_human_edits(
    client,
    db_session,
    monkeypatch,
):
    monkeypatch.setattr(settings, "ai_enabled", False)

    data, recommendation = prepare_recommendation(db_session)

    app.dependency_overrides[get_current_user] = (
        lambda: data["user"]
    )

    try:
        response = client.post(
            f"/api/evaluations/{data['evaluation'].id}"
            "/ai-recommendations/review",
            json={
                "decision": "ACCEPT",
                "recommendation_id": recommendation.id,
                "description": "Realizar monitoreo energético semanal",
                "priority": "MEDIUM",
                "responsible": "Coordinador ASG",
                "target_date": "2026-12-15",
            },
        )

        assert response.status_code == 200, response.text

        body = response.json()["recommendation"]

        assert body["id"] == recommendation.id
        assert body["status"] == "ACCEPTED"
        assert body["reviewed_by"] == data["user"].id
        assert body["reviewed_at"] is not None
        assert body["improvement_action_id"] is not None

        action = db_session.get(
            ImprovementAction,
            body["improvement_action_id"],
        )

        assert action is not None
        assert action.description == (
            "Realizar monitoreo energético semanal"
        )
        assert action.priority == ImprovementPriority.MEDIUM
        assert action.responsible == "Coordinador ASG"
        assert action.target_date == date(2026, 12, 15)

        db_session.refresh(recommendation)

        assert recommendation.description == "Registrar consumos mensuales"
        assert recommendation.priority == ImprovementPriority.HIGH

        audit_events = (
            db_session.query(AuditLog)
            .filter(
                AuditLog.action == "ai_recommendation.reviewed",
                AuditLog.resource_type == "ai_recommendation",
                AuditLog.resource_id == recommendation.id,
            )
            .all()
        )

        assert len(audit_events) == 1

        audit = audit_events[0]

        assert audit.actor_id == data["user"].id
        assert audit.company_id == data["evaluation"].company_id

        assert audit.context["decision"] == "ACCEPT"
        assert audit.context["evaluation_id"] == data["evaluation"].id
        assert audit.context["improvement_action_id"] == action.id

        assert audit.context["human_edits"] == {
            "description": {
                "original": "Registrar consumos mensuales",
                "accepted": "Realizar monitoreo energético semanal",
            },
            "priority": {
                "original": "HIGH",
                "accepted": "MEDIUM",
            },
        }

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_reject_recommendation_without_creating_action(
    client,
    db_session,
):
    data, recommendation = prepare_recommendation(db_session)

    app.dependency_overrides[get_current_user] = (
        lambda: data["user"]
    )

    try:
        response = client.post(
            f"/api/evaluations/{data['evaluation'].id}"
            "/ai-recommendations/review",
            json={
                "decision": "REJECT",
                "recommendation_id": recommendation.id,
            },
        )

        assert response.status_code == 200, response.text

        body = response.json()["recommendation"]

        assert body["status"] == "REJECTED"
        assert body["reviewed_by"] == data["user"].id
        assert body["improvement_action_id"] is None

        actions = (
            db_session.query(ImprovementAction)
            .filter(
                ImprovementAction.evaluation_id
                == data["evaluation"].id
            )
            .all()
        )

        assert actions == []

        audit_events = (
            db_session.query(AuditLog)
            .filter(
                AuditLog.action == "ai_recommendation.reviewed",
                AuditLog.resource_type == "ai_recommendation",
                AuditLog.resource_id == recommendation.id,
            )
            .all()
        )

        assert len(audit_events) == 1

        audit = audit_events[0]

        assert audit.actor_id == data["user"].id
        assert audit.context["decision"] == "REJECT"
        assert audit.context["improvement_action_id"] is None
        assert audit.context["human_edits"] == {}

    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.parametrize(
    "payload",
    [
        {
            "decision": "ACCEPT",
            "recommendation_id": 1,
        },
        {
            "decision": "ACCEPT",
            "recommendation_id": 1,
            "responsible": "Coordinador ASG",
        },
        {
            "decision": "REJECT",
            "recommendation_id": 1,
            "responsible": "Coordinador ASG",
        },
        {
            "decision": "INVALID",
            "recommendation_id": 1,
        },
    ],
)
def test_review_rejects_invalid_payloads(
    client,
    db_session,
    payload,
):
    data, recommendation = prepare_recommendation(db_session)

    payload["recommendation_id"] = recommendation.id

    app.dependency_overrides[get_current_user] = (
        lambda: data["user"]
    )

    try:
        response = client.post(
            f"/api/evaluations/{data['evaluation'].id}"
            "/ai-recommendations/review",
            json=payload,
        )

        assert response.status_code == 422

        db_session.refresh(recommendation)

        assert recommendation.status == AIRecommendationStatus.PENDING
        assert recommendation.improvement_action_id is None

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_review_rejects_collaborator(
    client,
    db_session,
):
    data, recommendation = prepare_recommendation(db_session)

    data["membership"].role = CompanyRole.COLLABORATOR
    db_session.commit()

    recommendation_id = recommendation.id

    app.dependency_overrides[get_current_user] = (
        lambda: data["user"]
    )

    try:
        response = client.post(
            f"/api/evaluations/{data['evaluation'].id}"
            "/ai-recommendations/review",
            json={
                "decision": "REJECT",
                "recommendation_id": recommendation.id,
            },
        )

        assert response.status_code == 403

        stored_recommendation = db_session.get(
            AIRecommendation,
            recommendation_id,
        )

        assert stored_recommendation is not None
        assert stored_recommendation.status == AIRecommendationStatus.PENDING
        assert stored_recommendation.improvement_action_id is None

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_review_prevents_duplicate_decision(
    client,
    db_session,
):
    data, recommendation = prepare_recommendation(db_session)

    app.dependency_overrides[get_current_user] = (
        lambda: data["user"]
    )

    url = (
        f"/api/evaluations/{data['evaluation'].id}"
        "/ai-recommendations/review"
    )

    try:
        first_response = client.post(
            url,
            json={
                "decision": "REJECT",
                "recommendation_id": recommendation.id,
            },
        )

        assert first_response.status_code == 200

        second_response = client.post(
            url,
            json={
                "decision": "REJECT",
                "recommendation_id": recommendation.id,
            },
        )

        assert second_response.status_code == 409
        assert second_response.json()["detail"] == (
            "AI recommendation already reviewed"
        )

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_accept_rolls_back_when_audit_fails(
    client,
    db_session,
):
    data, recommendation = prepare_recommendation(db_session)

    evaluation_id = data["evaluation"].id
    recommendation_id = recommendation.id
    user_id = data["user"].id

    # Conservar los registros de preparación ante el rollback.
    db_session.commit()

    app.dependency_overrides[get_current_user] = (
        lambda: data["user"]
    )

    try:
        with patch.object(
            AuditService,
            "record",
            side_effect=SQLAlchemyError(
                "Simulated audit failure"
            ),
        ):
            with pytest.raises(SQLAlchemyError):
                client.post(
                    f"/api/evaluations/{evaluation_id}"
                    "/ai-recommendations/review",
                    json={
                        "decision": "ACCEPT",
                        "recommendation_id": recommendation_id,
                        "description": (
                            "Registrar consumos semanalmente"
                        ),
                        "priority": "MEDIUM",
                        "responsible": "Coordinador ASG",
                        "target_date": "2026-12-15",
                    },
                )

        stored = db_session.get(
            AIRecommendation,
            recommendation_id,
        )

        assert stored is not None
        assert stored.status == AIRecommendationStatus.PENDING
        assert stored.reviewed_by is None
        assert stored.reviewed_at is None
        assert stored.improvement_action_id is None

        actions = db_session.execute(
            select(ImprovementAction).where(
                ImprovementAction.evaluation_id == evaluation_id
            )
        ).scalars().all()

        assert actions == []

        events = db_session.execute(
            select(AuditLog).where(
                AuditLog.action == "ai_recommendation.reviewed",
                AuditLog.resource_type == "ai_recommendation",
                AuditLog.resource_id == recommendation_id,
            )
        ).scalars().all()

        assert events == []

    finally:
        app.dependency_overrides.pop(get_current_user, None)
