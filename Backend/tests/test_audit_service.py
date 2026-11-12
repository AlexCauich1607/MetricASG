
from unittest.mock import Mock

from app.models.audit_log_model import AuditLog
from app.services.audit_service import AuditService
from uuid import uuid4

from sqlalchemy import select
from fastapi import HTTPException
from app.models.methodology_model import Methodology
from app.services.methodology_service import MethodologyService
from sqlalchemy.orm import Session
import pytest
from app.models.methodology_model import MethodologyStatus

def test_record_adds_audit_log_without_committing():
    db = Mock()

    audit_log = AuditService.record(
        db=db,
        action="methodology.published",
        resource_type="methodology",
        resource_id=10,
        actor_id=2,
        context={"status": "PUBLISHED"},
    )

    assert isinstance(audit_log, AuditLog)
    assert audit_log.action == "methodology.published"
    assert audit_log.resource_type == "methodology"
    assert audit_log.resource_id == 10
    assert audit_log.actor_id == 2
    assert audit_log.context == {"status": "PUBLISHED"}

    db.add.assert_called_once_with(audit_log)
    db.commit.assert_not_called()
    db.flush.assert_not_called()
    db.rollback.assert_not_called()


def test_record_uses_independent_empty_context():
    db = Mock()

    first = AuditService.record(
        db=db,
        action="user.created",
        resource_type="user",
        resource_id=1,
    )

    second = AuditService.record(
        db=db,
        action="user.updated",
        resource_type="user",
        resource_id=2,
    )

    assert first.context == {}
    assert second.context == {}
    assert first.context is not second.context


def test_methodology_creation_records_audit_event(db_session):
    version = f"audit-test-{uuid4().hex}"

    methodology = MethodologyService(db_session).create(
        {
            "name": "Audit Test Methodology",
            "version": version,
        },
        actor_id=1,
    )

    audit_log = db_session.execute(
        select(AuditLog).where(
            AuditLog.action == "methodology.created",
            AuditLog.resource_type == "methodology",
            AuditLog.resource_id == methodology.id,
        )
    ).scalar_one()

    assert isinstance(methodology, Methodology)
    assert audit_log.actor_id == 1
    assert audit_log.context == {"version": version}
    assert audit_log.created_at is not None


def test_audit_event_is_rolled_back_with_transaction():
    from tests.conftest import engine

    with engine.connect() as connection:
        transaction = connection.begin()

        try:
            with Session(bind=connection) as db:
                AuditService.record(
                    db=db,
                    action="methodology.updated",
                    resource_type="methodology",
                    resource_id=999999,
                    actor_id=1,
                    context={"test": "rollback"},
                )

                db.flush()

                audit_log = db.execute(
                    select(AuditLog).where(
                        AuditLog.action == "methodology.updated",
                        AuditLog.resource_id == 999999,
                        AuditLog.context["test"].as_string() == "rollback",
                    )
                ).scalar_one()

                audit_id = audit_log.id

            transaction.rollback()

            with Session(bind=engine) as verification_db:
                persisted_event = verification_db.get(
                    AuditLog,
                    audit_id,
                )

                assert persisted_event is None

        finally:
            if transaction.is_active:
                transaction.rollback()


def test_methodology_update_audit_only_on_changes(db_session):
    version = f"audit-update-{uuid4().hex}"

    service = MethodologyService(db_session)

    methodology = service.create(
        {
            "name": "Original Audit Methodology",
            "version": version,
        },
        actor_id=1,
    )

    methodology_id = methodology.id

    service.update(
        methodology_id,
        {"name": "Updated Audit Methodology"},
        actor_id=2,
    )

    audit_events = db_session.execute(
        select(AuditLog).where(
            AuditLog.action == "methodology.updated",
            AuditLog.resource_type == "methodology",
            AuditLog.resource_id == methodology_id,
        )
    ).scalars().all()

    assert len(audit_events) == 1
    assert audit_events[0].actor_id == 2
    assert audit_events[0].context == {
        "changed_fields": ["name"]
    }

    service.update(
        methodology_id,
        {"name": "Updated Audit Methodology"},
        actor_id=2,
    )

    audit_events = db_session.execute(
        select(AuditLog).where(
            AuditLog.action == "methodology.updated",
            AuditLog.resource_id == methodology_id,
        )
    ).scalars().all()

    assert len(audit_events) == 1


def test_methodology_publish_audit_and_invalid_state(db_session):
    version = f"audit-publish-{uuid4().hex}"

    service = MethodologyService(db_session)

    methodology = service.create(
        {
            "name": "Audit Publish Methodology",
            "version": version,
        },
        actor_id=1,
    )

    methodology_id = methodology.id

    published = service.publish(
        methodology_id,
        actor_id=2,
    )

    assert published.status == MethodologyStatus.PUBLISHED

    events = db_session.execute(
        select(AuditLog).where(
            AuditLog.action == "methodology.published",
            AuditLog.resource_type == "methodology",
            AuditLog.resource_id == methodology_id,
        )
    ).scalars().all()

    assert len(events) == 1
    assert events[0].actor_id == 2
    assert events[0].context == {"status": "PUBLISHED"}

    with pytest.raises(HTTPException) as exc_info:
        service.publish(
            methodology_id,
            actor_id=2,
        )

    assert exc_info.value.status_code == 409

    events = db_session.execute(
        select(AuditLog).where(
            AuditLog.action == "methodology.published",
            AuditLog.resource_id == methodology_id,
        )
    ).scalars().all()

    assert len(events) == 1

def test_methodology_activation_records_audit_event(db_session):
    service = MethodologyService(db_session)

    first = service.create(
        {
            "name": "First Audit Methodology",
            "version": f"audit-first-{uuid4().hex}",
        },
        actor_id=1,
    )

    second = service.create(
        {
            "name": "Second Audit Methodology",
            "version": f"audit-second-{uuid4().hex}",
        },
        actor_id=1,
    )

    service.publish(first.id, actor_id=1)
    service.publish(second.id, actor_id=1)

    service.activate(first.id, actor_id=2)

    assert service.read(first.id).is_active is True

    service.activate(second.id, actor_id=3)

    db_session.expire_all()

    assert service.read(first.id).is_active is False
    assert service.read(second.id).is_active is True

    events = db_session.execute(
        select(AuditLog).where(
            AuditLog.action == "methodology.activated",
            AuditLog.resource_type == "methodology",
            AuditLog.resource_id == second.id,
        )
    ).scalars().all()

    assert len(events) == 1
    assert events[0].actor_id == 3
    assert events[0].context == {
        "is_active": True,
        "version": second.version,
    }

def test_methodology_archive_audit_and_active_rejection(db_session):
    service = MethodologyService(db_session)

    first = service.create(
        {
            "name": "Archivable Audit Methodology",
            "version": f"audit-archive-{uuid4().hex}",
        },
        actor_id=1,
    )

    second = service.create(
        {
            "name": "Active Audit Methodology",
            "version": f"audit-active-{uuid4().hex}",
        },
        actor_id=1,
    )

    service.publish(first.id, actor_id=1)
    service.publish(second.id, actor_id=1)

    service.activate(second.id, actor_id=2)

    archived = service.archive(
        first.id,
        actor_id=3,
    )

    assert archived.status == MethodologyStatus.ARCHIVED

    events = db_session.execute(
        select(AuditLog).where(
            AuditLog.action == "methodology.archived",
            AuditLog.resource_type == "methodology",
            AuditLog.resource_id == first.id,
        )
    ).scalars().all()

    assert len(events) == 1
    assert events[0].actor_id == 3
    assert events[0].context == {
        "status": "ARCHIVED",
        "version": first.version,
    }

    with pytest.raises(HTTPException) as exc_info:
        service.archive(
            second.id,
            actor_id=3,
        )

    assert exc_info.value.status_code == 409

    rejected_events = db_session.execute(
        select(AuditLog).where(
            AuditLog.action == "methodology.archived",
            AuditLog.resource_id == second.id,
        )
    ).scalars().all()

    assert rejected_events == []


def test_list_logs_filters_and_paginates(db_session):
    from datetime import datetime, timedelta, timezone
    from uuid import uuid4

    from app.models.audit_log_model import AuditLog
    from app.services.audit_service import AuditService

    action = f"test.audit_{uuid4().hex}"
    base_date = datetime(2026, 11, 12, tzinfo=timezone.utc)

    logs = []

    for index in range(4):
        log = AuditLog(
            actor_id=10,
            company_id=1 if index < 3 else 2,
            action=action,
            resource_type="test_resource",
            resource_id=index + 1,
            context={"index": index},
            created_at=base_date + timedelta(minutes=index),
        )

        db_session.add(log)
        logs.append(log)

    db_session.flush()

    result = AuditService.list_logs(
        db=db_session,
        company_id=1,
        action=action,
        limit=1,
        offset=1,
    )

    assert result["total"] == 3
    assert result["limit"] == 1
    assert result["offset"] == 1
    assert len(result["items"]) == 1

    # Orden descendente: índice 2, índice 1, índice 0.
    # Con offset=1 obtenemos el registro de índice 1.
    assert result["items"][0].id == logs[1].id
    assert result["items"][0].resource_id == 2


def test_list_logs_filters_by_actor_resource_and_date(db_session):
    from datetime import datetime, timedelta, timezone
    from uuid import uuid4

    from app.models.audit_log_model import AuditLog
    from app.services.audit_service import AuditService

    action = f"test.audit_{uuid4().hex}"
    base_date = datetime(2026, 11, 12, tzinfo=timezone.utc)

    logs = [
        AuditLog(
            actor_id=101,
            action=action,
            resource_type="evaluation",
            resource_id=50,
            context={},
            created_at=base_date,
        ),
        AuditLog(
            actor_id=101,
            action=action,
            resource_type="evaluation",
            resource_id=50,
            context={},
            created_at=base_date + timedelta(days=1),
        ),
        AuditLog(
            actor_id=202,
            action=action,
            resource_type="evaluation",
            resource_id=50,
            context={},
            created_at=base_date + timedelta(days=1),
        ),
        AuditLog(
            actor_id=101,
            action=action,
            resource_type="user",
            resource_id=50,
            context={},
            created_at=base_date + timedelta(days=1),
        ),
        AuditLog(
            actor_id=101,
            action=action,
            resource_type="evaluation",
            resource_id=99,
            context={},
            created_at=base_date + timedelta(days=1),
        ),
    ]

    db_session.add_all(logs)
    db_session.flush()

    result = AuditService.list_logs(
        db=db_session,
        actor_id=101,
        action=action,
        resource_type="evaluation",
        resource_id=50,
        start_date=base_date + timedelta(hours=12),
        end_date=base_date + timedelta(days=2),
    )

    assert result["total"] == 1
    assert result["limit"] == 20
    assert result["offset"] == 0
    assert len(result["items"]) == 1
    assert result["items"][0].id == logs[1].id
