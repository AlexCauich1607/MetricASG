
from datetime import date

from sqlalchemy import select

from app.models.ai_recommendation_acceptance_request import (
    AIRecommendationAcceptanceRequest,
)
from app.models.ai_recommendation_model import (
    AIRecommendation,
    AIRecommendationStatus,
)
from app.models.audit_log_model import AuditLog
from app.models.evaluation_model import EvaluationStatus
from app.models.improvement_action_model import (
    ImprovementAction,
    ImprovementStatus,
)
from app.services.ai_recommendation_review_service import (
    AIRecommendationReviewService,
)
from tests.test_evaluation_evidence import create_evidence_data
import pytest
from fastapi import HTTPException
from app.core.roles import CompanyRole
from app.models.company_membership_model import CompanyMembershipStatus
from unittest.mock import patch

from sqlalchemy.exc import SQLAlchemyError
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from sqlalchemy.orm import Session

from tests.conftest import engine
from uuid import uuid4

from sqlalchemy import create_engine

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
        priority="HIGH",
    )

    db_session.add(recommendation)
    db_session.commit()

    return data, recommendation.id


def test_accepts_recommendation_with_human_edits(db_session):
    data, recommendation_id = prepare_recommendation(db_session)

    payload = AIRecommendationAcceptanceRequest(
        decision="ACCEPT",
        recommendation_id=recommendation_id,
        description="Implementar seguimiento semanal",
        priority="MEDIUM",
        responsible="Coordinador ASG",
        target_date=date(2026, 12, 15),
    )

    result = AIRecommendationReviewService(db_session).review(
        evaluation_id=data["evaluation"].id,
        user_id=data["user"].id,
        payload=payload,
    )

    assert result.status == AIRecommendationStatus.ACCEPTED
    assert result.reviewed_by == data["user"].id
    assert result.reviewed_at is not None
    assert result.improvement_action_id is not None

    action = db_session.get(
        ImprovementAction,
        result.improvement_action_id,
    )

    assert action is not None
    assert action.description == "Implementar seguimiento semanal"
    assert action.priority.value == "MEDIUM"
    assert action.responsible == "Coordinador ASG"
    assert action.target_date == date(2026, 12, 15)
    assert action.status == ImprovementStatus.PENDING

    # La propuesta original de IA permanece intacta.
    assert result.description == "Registrar consumos mensuales"
    assert result.priority.value == "HIGH"

    events = db_session.execute(
        select(AuditLog).where(
            AuditLog.action == "ai_recommendation.reviewed",
            AuditLog.resource_id == recommendation_id,
        )
    ).scalars().all()

    assert len(events) == 1
    assert events[0].actor_id == data["user"].id
    assert events[0].context["decision"] == "ACCEPT"


def test_rejects_recommendation_without_creating_action(db_session):
    data, recommendation_id = prepare_recommendation(db_session)

    payload = AIRecommendationAcceptanceRequest(
        decision="REJECT",
        recommendation_id=recommendation_id,
    )

    result = AIRecommendationReviewService(db_session).review(
        evaluation_id=data["evaluation"].id,
        user_id=data["user"].id,
        payload=payload,
    )

    assert result.status == AIRecommendationStatus.REJECTED
    assert result.reviewed_by == data["user"].id
    assert result.reviewed_at is not None
    assert result.improvement_action_id is None

    actions = db_session.execute(
        select(ImprovementAction).where(
            ImprovementAction.evaluation_id == data["evaluation"].id
        )
    ).scalars().all()

    assert actions == []

    events = db_session.execute(
        select(AuditLog).where(
            AuditLog.action == "ai_recommendation.reviewed",
            AuditLog.resource_id == recommendation_id,
        )
    ).scalars().all()

    assert len(events) == 1
    assert events[0].context["decision"] == "REJECT"


@pytest.mark.parametrize(
    "first_decision,second_decision",
    [
        ("ACCEPT", "ACCEPT"),
        ("ACCEPT", "REJECT"),
        ("REJECT", "ACCEPT"),
        ("REJECT", "REJECT"),
    ],
)
def test_prevents_reviewing_recommendation_twice(
    db_session,
    first_decision,
    second_decision,
):
    data, recommendation_id = prepare_recommendation(db_session)

    service = AIRecommendationReviewService(db_session)

    def build_payload(decision):
        payload = {
            "decision": decision,
            "recommendation_id": recommendation_id,
        }

        if decision == "ACCEPT":
            payload.update(
                {
                    "responsible": "Coordinador ASG",
                    "target_date": date(2026, 12, 15),
                }
            )

        return AIRecommendationAcceptanceRequest.model_validate(
            payload
        )

    service.review(
        evaluation_id=data["evaluation"].id,
        user_id=data["user"].id,
        payload=build_payload(first_decision),
    )

    with pytest.raises(HTTPException) as exc:
        service.review(
            evaluation_id=data["evaluation"].id,
            user_id=data["user"].id,
            payload=build_payload(second_decision),
        )

    assert exc.value.status_code == 409
    assert exc.value.detail == "AI recommendation already reviewed"

    actions = db_session.execute(
        select(ImprovementAction).where(
            ImprovementAction.evaluation_id == data["evaluation"].id
        )
    ).scalars().all()

    expected_actions = 1 if first_decision == "ACCEPT" else 0

    assert len(actions) == expected_actions


@pytest.mark.parametrize(
    "role,expected_status",
    [
        (CompanyRole.COMPANY_ADMIN, 200),
        (CompanyRole.ASG_MANAGER, 200),
        (CompanyRole.COLLABORATOR, 403),
        (CompanyRole.AUDITOR, 403),
    ],
)
@pytest.mark.parametrize("decision", ["ACCEPT", "REJECT"])
def test_review_enforces_company_roles(
    db_session,
    role,
    expected_status,
    decision,
):
    data, recommendation_id = prepare_recommendation(db_session)

    data["membership"].role = role
    db_session.commit()

    payload_data = {
        "decision": decision,
        "recommendation_id": recommendation_id,
    }

    if decision == "ACCEPT":
        payload_data.update(
            {
                "responsible": "Coordinador ASG",
                "target_date": date(2026, 12, 15),
            }
        )

    payload = AIRecommendationAcceptanceRequest.model_validate(
        payload_data
    )

    service = AIRecommendationReviewService(db_session)

    if expected_status == 200:
        result = service.review(
            evaluation_id=data["evaluation"].id,
            user_id=data["user"].id,
            payload=payload,
        )

        assert result.status == (
            AIRecommendationStatus.ACCEPTED
            if decision == "ACCEPT"
            else AIRecommendationStatus.REJECTED
        )
    else:
        with pytest.raises(HTTPException) as exc:
            service.review(
                evaluation_id=data["evaluation"].id,
                user_id=data["user"].id,
                payload=payload,
            )

        assert exc.value.status_code == expected_status

        db_session.expire_all()

        recommendation = db_session.get(
            AIRecommendation,
            recommendation_id,
        )

        assert recommendation.status == AIRecommendationStatus.PENDING
        assert recommendation.improvement_action_id is None


def test_review_rejects_inactive_membership(db_session):
    data, recommendation_id = prepare_recommendation(db_session)

    data["membership"].status = CompanyMembershipStatus.INACTIVE
    db_session.commit()

    payload = AIRecommendationAcceptanceRequest(
        decision="REJECT",
        recommendation_id=recommendation_id,
    )

    with pytest.raises(HTTPException) as exc:
        AIRecommendationReviewService(db_session).review(
            evaluation_id=data["evaluation"].id,
            user_id=data["user"].id,
            payload=payload,
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == "Evaluation not found"

    db_session.expire_all()

    recommendation = db_session.get(
        AIRecommendation,
        recommendation_id,
    )

    assert recommendation.status == AIRecommendationStatus.PENDING


def test_review_rejects_other_user(db_session):
    data, recommendation_id = prepare_recommendation(db_session)

    payload = AIRecommendationAcceptanceRequest(
        decision="REJECT",
        recommendation_id=recommendation_id,
    )

    with pytest.raises(HTTPException) as exc:
        AIRecommendationReviewService(db_session).review(
            evaluation_id=data["evaluation"].id,
            user_id=data["user"].id + 99999,
            payload=payload,
        )

    assert exc.value.status_code == 404


def test_acceptance_rolls_back_when_commit_fails(db_session):
    data, recommendation_id = prepare_recommendation(db_session)
    evaluation_id = data["evaluation"].id
    user_id = data["user"].id

    payload = AIRecommendationAcceptanceRequest(
        decision="ACCEPT",
        recommendation_id=recommendation_id,
        description="Seguimiento semanal de consumos",
        priority="MEDIUM",
        responsible="Coordinador ASG",
        target_date=date(2026, 12, 15),
    )

    service = AIRecommendationReviewService(db_session)

    with patch.object(
        db_session,
        "commit",
        side_effect=SQLAlchemyError("Simulated commit failure"),
    ):
        with pytest.raises(SQLAlchemyError):
            service.review(
                evaluation_id=evaluation_id,
                user_id=user_id,
                payload=payload,
            )

    # Consultar nuevamente después del rollback.
    db_session.expire_all()

    recommendation = db_session.get(
        AIRecommendation,
        recommendation_id,
    )

    assert recommendation.status == AIRecommendationStatus.PENDING
    assert recommendation.reviewed_by is None
    assert recommendation.reviewed_at is None
    assert recommendation.improvement_action_id is None

    actions = db_session.execute(
        select(ImprovementAction).where(
            ImprovementAction.evaluation_id == evaluation_id
        )
    ).scalars().all()

    assert actions == []

    events = db_session.execute(
        select(AuditLog).where(
            AuditLog.action == "ai_recommendation.reviewed",
            AuditLog.resource_id == recommendation_id,
        )
    ).scalars().all()

    assert events == []



def test_concurrent_acceptance_creates_only_one_action():
    schema_name = f"test_ai_review_{uuid4().hex}"

    # Crear un esquema independiente dentro de la base de pruebas.
    with engine.begin() as connection:
        connection.exec_driver_sql(
            f'CREATE SCHEMA "{schema_name}"'
        )

    isolated_engine = create_engine(
        engine.url,
        connect_args={
            "options": f"-csearch_path={schema_name}",
        },
    )

    try:
        # Los modelos ya están registrados desde conftest.py.
        AIRecommendation.metadata.create_all(
            bind=isolated_engine
        )

        # Preparar datos confirmados y visibles para otras conexiones.
        with Session(isolated_engine) as session:
            data, recommendation_id = prepare_recommendation(
                session
            )

            evaluation_id = data["evaluation"].id
            user_id = data["user"].id

        barrier = Barrier(2)

        def accept_recommendation():
            with Session(isolated_engine) as session:
                payload = AIRecommendationAcceptanceRequest(
                    decision="ACCEPT",
                    recommendation_id=recommendation_id,
                    responsible="Coordinador ASG",
                    target_date=date(2026, 12, 15),
                )

                barrier.wait(timeout=10)

                try:
                    result = AIRecommendationReviewService(
                        session
                    ).review(
                        evaluation_id=evaluation_id,
                        user_id=user_id,
                        payload=payload,
                    )

                    return result.status.value

                except HTTPException as exc:
                    return exc.status_code

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [
                executor.submit(accept_recommendation)
                for _ in range(2)
            ]

            results = [
                future.result(timeout=20)
                for future in futures
            ]

        assert sorted(results, key=str) == sorted(
            ["ACCEPTED", 409],
            key=str,
        )

        # Verificar el resultado en una sesión nueva.
        with Session(isolated_engine) as session:
            recommendation = session.get(
                AIRecommendation,
                recommendation_id,
            )

            assert recommendation is not None
            assert (
                recommendation.status
                == AIRecommendationStatus.ACCEPTED
            )

            actions = session.execute(
                select(ImprovementAction).where(
                    ImprovementAction.evaluation_id
                    == evaluation_id
                )
            ).scalars().all()

            assert len(actions) == 1

            assert (
                recommendation.improvement_action_id
                == actions[0].id
            )

    finally:
        isolated_engine.dispose()

        # Eliminar todos los datos creados para esta prueba.
        with engine.begin() as connection:
            connection.exec_driver_sql(
                f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'
            )
