
from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.models.ai_recommendation_model import (
    AIRecommendation,
    AIRecommendationStatus,
)
from app.models.ai_recommendation_request import AIRecommendationRequest
from app.models.ai_recommendation_response import AIRecommendationResponse
from app.models.evaluation_model import EvaluationStatus
from app.services.ai_recommendation_persistence_service import (
    AIRecommendationPersistenceService,
)
from tests.test_evaluation_evidence import create_evidence_data
from unittest.mock import patch

from sqlalchemy.exc import SQLAlchemyError
from app.models.audit_log_model import AuditLog
from app.services.audit_service import AuditService

def build_context(evaluation):
    return AIRecommendationRequest.model_validate(
        {
            "evaluation": {
                "id": evaluation.id,
                "date": datetime(2026, 11, 17),
                "methodology": {
                    "id": evaluation.methodology_id,
                    "name": "Metodología ASG",
                    "version": "1.0",
                },
            },
            "global_result": {
                "score": 7.8,
                "maturity_level": "Nivel de prueba",
            },
            "ambits": [
                {
                    "id": 1,
                    "name": "Ambiental",
                    "score": 7.2,
                    "maturity_level": "Nivel de prueba",
                }
            ],
            "gaps": [
                {
                    "indicator_id": None,
                    "description": "Falta seguimiento energético",
                    "priority": "HIGH",
                }
            ],
        }
    )


def build_response():
    return AIRecommendationResponse.model_validate(
        {
            "recommendations": [
                {
                    "indicator_id": None,
                    "gap_description": "Falta seguimiento energético",
                    "title": "Monitoreo energético",
                    "description": "Registrar consumos mensuales",
                    "justification": "Atiende la brecha registrada",
                    "priority": "HIGH",
                }
            ]
        }
    )


def prepare_evaluation(db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    evaluation.status = EvaluationStatus.COMPLETED

    db_session.flush()

    return data


def test_saves_valid_recommendations(db_session):
    data = prepare_evaluation(db_session)
    evaluation = data["evaluation"]

    service = AIRecommendationPersistenceService(db_session)

    saved = service.save_recommendations(
        evaluation_id=evaluation.id,
        user_id=data["user"].id,
        context=build_context(evaluation),
        response=build_response(),
    )

    assert len(saved) == 1

    recommendation = saved[0]

    assert recommendation.id is not None
    assert recommendation.evaluation_id == evaluation.id
    assert recommendation.status == AIRecommendationStatus.PENDING
    assert recommendation.improvement_action_id is None
    assert recommendation.reviewed_by is None

    db_session.expire_all()

    stored = db_session.get(AIRecommendation, recommendation.id)

    assert stored is not None
    assert stored.description == "Registrar consumos mensuales"


def test_saves_empty_recommendation_list(db_session):
    data = prepare_evaluation(db_session)
    evaluation = data["evaluation"]

    service = AIRecommendationPersistenceService(db_session)

    saved = service.save_recommendations(
        evaluation_id=evaluation.id,
        user_id=data["user"].id,
        context=build_context(evaluation),
        response=AIRecommendationResponse(recommendations=[]),
    )

    assert saved == []

    stored = db_session.execute(
        select(AIRecommendation).where(
            AIRecommendation.evaluation_id == evaluation.id
        )
    ).scalars().all()

    assert stored == []


def test_rejects_mismatched_evaluation_context(db_session):
    data = prepare_evaluation(db_session)
    evaluation = data["evaluation"]

    context = build_context(evaluation)
    context.evaluation.id = evaluation.id + 999

    service = AIRecommendationPersistenceService(db_session)

    with pytest.raises(HTTPException) as exc:
        service.save_recommendations(
            evaluation_id=evaluation.id,
            user_id=data["user"].id,
            context=context,
            response=build_response(),
        )

    assert exc.value.status_code == 422


def test_rejects_unauthorized_user(db_session):
    data = prepare_evaluation(db_session)
    evaluation = data["evaluation"]

    # Conservar la evaluación ante el rollback por autorización.
    db_session.commit()

    service = AIRecommendationPersistenceService(db_session)

    with pytest.raises(HTTPException) as exc:
        service.save_recommendations(
            evaluation_id=evaluation.id,
            user_id=data["user"].id + 99999,
            context=build_context(evaluation),
            response=build_response(),
        )

    assert exc.value.status_code == 404


def test_rejects_unregistered_gap(db_session):
    data = prepare_evaluation(db_session)
    evaluation = data["evaluation"]

    response = build_response()
    response.recommendations[0].gap_description = (
        "Brecha no autorizada"
    )

    service = AIRecommendationPersistenceService(db_session)

    with pytest.raises(HTTPException) as exc:
        service.save_recommendations(
            evaluation_id=evaluation.id,
            user_id=data["user"].id,
            context=build_context(evaluation),
            response=response,
        )

    assert exc.value.status_code == 422

    stored = db_session.execute(
        select(AIRecommendation).where(
            AIRecommendation.evaluation_id == evaluation.id
        )
    ).scalars().all()

    assert stored == []


def test_rejects_draft_evaluation(db_session):
    data = create_evidence_data(db_session)
    evaluation = data["evaluation"]

    db_session.commit()

    service = AIRecommendationPersistenceService(db_session)

    with pytest.raises(HTTPException) as exc:
        service.save_recommendations(
            evaluation_id=evaluation.id,
            user_id=data["user"].id,
            context=build_context(evaluation),
            response=build_response(),
        )

    assert exc.value.status_code == 409


def test_rolls_back_when_persistence_fails(db_session):
    data = prepare_evaluation(db_session)
    evaluation = data["evaluation"]

    # Conservar los datos de preparación ante el rollback.
    db_session.commit()

    service = AIRecommendationPersistenceService(db_session)

    with patch.object(
        db_session,
        "flush",
        side_effect=SQLAlchemyError("Simulated database error"),
    ):
        with pytest.raises(SQLAlchemyError):
            service.save_recommendations(
                evaluation_id=evaluation.id,
                user_id=data["user"].id,
                context=build_context(evaluation),
                response=build_response(),
            )

    assert len(db_session.new) == 0

    stored = db_session.execute(
        select(AIRecommendation).where(
            AIRecommendation.evaluation_id == evaluation.id
        )
    ).scalars().all()

    assert stored == []


def test_generation_records_audit_event(db_session):
    data = prepare_evaluation(db_session)
    evaluation = data["evaluation"]
    user = data["user"]

    saved = AIRecommendationPersistenceService(
        db_session
    ).save_recommendations(
        evaluation_id=evaluation.id,
        user_id=user.id,
        context=build_context(evaluation),
        response=build_response(),
    )

    assert len(saved) == 1

    recommendation = saved[0]

    db_session.expire_all()

    events = db_session.execute(
        select(AuditLog).where(
            AuditLog.action == "ai_recommendation.generated",
            AuditLog.resource_type == "ai_recommendation",
            AuditLog.resource_id == recommendation.id,
        )
    ).scalars().all()

    assert len(events) == 1

    event = events[0]

    assert event.actor_id == user.id
    assert event.company_id == evaluation.company_id
    assert event.created_at is not None

    assert event.context == {
        "evaluation_id": evaluation.id,
        "indicator_id": recommendation.indicator_id,
        "gap_description": recommendation.gap_description,
        "title": recommendation.title,
        "description": recommendation.description,
        "justification": recommendation.justification,
        "priority": recommendation.priority.value,
        "status": "PENDING",
    }


def test_empty_generation_does_not_create_audit_events(
    db_session,
):
    data = prepare_evaluation(db_session)
    evaluation = data["evaluation"]

    saved = AIRecommendationPersistenceService(
        db_session
    ).save_recommendations(
        evaluation_id=evaluation.id,
        user_id=data["user"].id,
        context=build_context(evaluation),
        response=AIRecommendationResponse(recommendations=[]),
    )

    assert saved == []

    events = db_session.execute(
        select(AuditLog).where(
            AuditLog.action == "ai_recommendation.generated",
            AuditLog.resource_type == "ai_recommendation",
            AuditLog.company_id == evaluation.company_id,
            AuditLog.context["evaluation_id"].as_integer()
            == evaluation.id,
        )
    ).scalars().all()

    assert events == []


def test_generation_rolls_back_when_audit_fails(
    db_session,
):
    data = prepare_evaluation(db_session)
    evaluation = data["evaluation"]

    # Conservar los registros de preparación ante el rollback.
    db_session.commit()

    service = AIRecommendationPersistenceService(db_session)

    with patch.object(
        AuditService,
        "record",
        side_effect=SQLAlchemyError(
            "Simulated audit persistence error"
        ),
    ):
        with pytest.raises(SQLAlchemyError):
            service.save_recommendations(
                evaluation_id=evaluation.id,
                user_id=data["user"].id,
                context=build_context(evaluation),
                response=build_response(),
            )

    recommendations = db_session.execute(
        select(AIRecommendation).where(
            AIRecommendation.evaluation_id == evaluation.id
        )
    ).scalars().all()

    events = db_session.execute(
        select(AuditLog).where(
            AuditLog.action == "ai_recommendation.generated",
            AuditLog.resource_type == "ai_recommendation",
            AuditLog.company_id == evaluation.company_id,
            AuditLog.context["evaluation_id"].as_integer()
            == evaluation.id,
        )
    ).scalars().all()

    assert recommendations == []
    assert events == []
