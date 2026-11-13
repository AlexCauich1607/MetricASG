import uuid

import pytest
from sqlalchemy import select

from app.models.notification_event_preference_model import (
    NotificationEventPreference,
)
from app.models.notification_event_preference_request import (
    NotificationEventType,
)
from app.models.notification_model import (
    Notification,
    NotificationChannel,
    NotificationStatus,
)
from app.models.notification_preference_model import (
    NotificationPreference,
)
from app.models.user_model import User
from app.services.notification_service import NotificationService


EVENT = NotificationEventType.IMPROVEMENT_ACTION_DUE


@pytest.fixture
def notification_user(db_session):
    user = User(
        name="Notification Service Test",
        company_name="Test Company",
        email=f"notification-service-{uuid.uuid4().hex}@test.local",
        password="test-password-hash",
    )

    db_session.add(user)
    db_session.flush()

    return user


def create_notification(service, user_id, **overrides):
    values = {
        "user_id": user_id,
        "event_type": EVENT,
        "channel": NotificationChannel.IN_APP,
        "title": "Acción próxima a vencer",
        "message": "Una acción requiere seguimiento.",
        "deduplication_key": "action:100:due",
        "resource_type": "improvement_action",
        "resource_id": 100,
    }

    values.update(overrides)

    return service.create(**values)


def test_creates_notification_with_default_preferences(
    db_session,
    notification_user,
):
    service = NotificationService(db_session)

    created = create_notification(
        service,
        notification_user.id,
    )

    assert created is True

    notification = db_session.scalars(
        select(Notification).where(
            Notification.user_id == notification_user.id
        )
    ).one()

    assert notification.event_type == EVENT.value
    assert notification.channel == NotificationChannel.IN_APP
    assert notification.status == NotificationStatus.PENDING
    assert notification.resource_type == "improvement_action"
    assert notification.resource_id == 100
    assert notification.read_at is None


def test_duplicate_notification_is_not_created(
    db_session,
    notification_user,
):
    service = NotificationService(db_session)

    assert create_notification(
        service,
        notification_user.id,
    ) is True

    assert create_notification(
        service,
        notification_user.id,
    ) is False

    notifications = db_session.scalars(
        select(Notification).where(
            Notification.user_id == notification_user.id
        )
    ).all()

    assert len(notifications) == 1


def test_notification_channels_are_independent(
    db_session,
    notification_user,
):
    service = NotificationService(db_session)

    assert create_notification(
        service,
        notification_user.id,
        channel=NotificationChannel.IN_APP,
    ) is True

    assert create_notification(
        service,
        notification_user.id,
        channel=NotificationChannel.EMAIL,
    ) is True

    notifications = db_session.scalars(
        select(Notification).where(
            Notification.user_id == notification_user.id
        )
    ).all()

    assert len(notifications) == 2

    assert {item.channel for item in notifications} == {
        NotificationChannel.IN_APP,
        NotificationChannel.EMAIL,
    }


def test_global_preference_disables_notification(
    db_session,
    notification_user,
):
    db_session.add(
        NotificationPreference(
            user_id=notification_user.id,
            in_app_enabled=False,
            email_enabled=True,
        )
    )
    db_session.flush()

    service = NotificationService(db_session)

    assert create_notification(
        service,
        notification_user.id,
    ) is False

    assert db_session.query(Notification).filter_by(
        user_id=notification_user.id
    ).count() == 0


def test_event_preference_disables_notification(
    db_session,
    notification_user,
):
    db_session.add(
        NotificationEventPreference(
            user_id=notification_user.id,
            event_type=EVENT.value,
            in_app_enabled=False,
            email_enabled=True,
        )
    )
    db_session.flush()

    service = NotificationService(db_session)

    assert create_notification(
        service,
        notification_user.id,
    ) is False

    assert db_session.query(Notification).filter_by(
        user_id=notification_user.id
    ).count() == 0


def test_disabled_channel_does_not_block_other_channel(
    db_session,
    notification_user,
):
    db_session.add(
        NotificationPreference(
            user_id=notification_user.id,
            in_app_enabled=False,
            email_enabled=True,
        )
    )
    db_session.flush()

    service = NotificationService(db_session)

    assert create_notification(
        service,
        notification_user.id,
        channel=NotificationChannel.IN_APP,
    ) is False

    assert create_notification(
        service,
        notification_user.id,
        channel=NotificationChannel.EMAIL,
    ) is True


@pytest.mark.parametrize(
    "invalid_event,invalid_channel",
    [
        ("UNKNOWN_EVENT", NotificationChannel.IN_APP),
        (EVENT, "SMS"),
    ],
)
def test_invalid_event_or_channel_rejected(
    db_session,
    notification_user,
    invalid_event,
    invalid_channel,
):
    service = NotificationService(db_session)

    with pytest.raises(ValueError):
        create_notification(
            service,
            notification_user.id,
            event_type=invalid_event,
            channel=invalid_channel,
        )


def test_service_does_not_commit_transaction(
    db_session,
    notification_user,
    monkeypatch,
):
    service = NotificationService(db_session)

    def unexpected_commit():
        raise AssertionError(
            "NotificationService must not commit transactions"
        )

    monkeypatch.setattr(
        db_session,
        "commit",
        unexpected_commit,
    )

    assert create_notification(
        service,
        notification_user.id,
    ) is True
