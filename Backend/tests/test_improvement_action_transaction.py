
from datetime import date
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.models.audit_log_model import AuditLog
from app.models.evaluation_model import EvaluationStatus
from app.models.improvement_action_model import ImprovementAction
from app.models.improvement_action_request import ImprovementActionCreate
from app.services.improvement_action_service import ImprovementActionService
from tests.test_evaluation_evidence import create_evidence_data


def build_payload():
    return ImprovementActionCreate(
        indicator_id=None,
        gap_description="Consumo energético elevado",
        description="Implementar iluminación LED",
        priority="HIGH",
        responsible="Operaciones",
        target_date=date(2026, 12, 15),
    )


def prepare_completed_evaluation(db_session):
    data = create_evidence_data(db_session)
    data["evaluation"].status = EvaluationStatus.COMPLETED
    db_session.flush()
    return data


def test_create_action_commits_by_default(db_session):
    data = prepare_completed_evaluation(db_session)

    service = ImprovementActionService(db_session)

    with patch.object(
        db_session,
        "commit",
        wraps=db_session.commit,
    ) as commit_mock:
        with patch.object(
            db_session,
            "refresh",
            wraps=db_session.refresh,
        ) as refresh_mock:
            action = service.create_action(
                evaluation_id=data["evaluation"].id,
                user_id=data["user"].id,
                payload=build_payload(),
            )

    assert isinstance(action, ImprovementAction)
    assert action.id is not None
    commit_mock.assert_called_once()
    refresh_mock.assert_called_once_with(action)


def test_create_action_without_commit(db_session):
    data = prepare_completed_evaluation(db_session)

    service = ImprovementActionService(db_session)

    with patch.object(
        db_session,
        "commit",
        wraps=db_session.commit,
    ) as commit_mock:
        with patch.object(
            db_session,
            "refresh",
            wraps=db_session.refresh,
        ) as refresh_mock:
            action = service.create_action(
                evaluation_id=data["evaluation"].id,
                user_id=data["user"].id,
                payload=build_payload(),
                commit=False,
            )

    assert action.id is not None
    assert action.evaluation_id == data["evaluation"].id

    commit_mock.assert_not_called()
    refresh_mock.assert_not_called()

    saved_action = db_session.get(
        ImprovementAction,
        action.id,
    )

    assert saved_action is not None


def test_create_action_without_commit_records_audit(db_session):
    data = prepare_completed_evaluation(db_session)

    service = ImprovementActionService(db_session)

    action = service.create_action(
        evaluation_id=data["evaluation"].id,
        user_id=data["user"].id,
        payload=build_payload(),
        commit=False,
    )

    db_session.flush()

    events = db_session.execute(
        select(AuditLog).where(
            AuditLog.action == "improvement_action.created",
            AuditLog.resource_id == action.id,
        )
    ).scalars().all()

    assert len(events) == 1
    assert events[0].actor_id == data["user"].id


def test_create_action_without_commit_rejects_draft(db_session):
    data = create_evidence_data(db_session)

    db_session.commit()

    service = ImprovementActionService(db_session)

    with pytest.raises(HTTPException) as exc:
        service.create_action(
            evaluation_id=data["evaluation"].id,
            user_id=data["user"].id,
            payload=build_payload(),
            commit=False,
        )

    assert exc.value.status_code == 409
