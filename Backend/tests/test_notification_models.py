from datetime import datetime, timezone

import pytest
from sqlalchemy.exc import IntegrityError, StatementError

from app.models.notification_model import (
    Notification,
    NotificationChannel,
    NotificationStatus,
)
from app.models.user_model import User


@pytest.fixture
def notification_user(db_session):
    user = User(
        name="Notification Test",
        company_name="Test Company",
        email="notification-test@example.com",
        password="test-password-hash",
    )

    db_session.add(user)
    db_session.flush()

    return user


def create_notification(user_id, **overrides):
    data = {
        "user_id": user_id,
        "event_type": "REEVALUATION_REMINDER",
        "channel": NotificationChannel.IN_APP,
        "title": "Upcoming reevaluation",
        "message": "Your next evaluation is approaching.",
        "resource_type": "reevaluation_reminder",
        "resource_id": 1,
        "deduplication_key": "reevaluation:1:first",
    }

    data.update(overrides)

    return Notification(**data)


def test_create_notification(db_session, notification_user):
    notification = create_notification(notification_user.id)

    db_session.add(notification)
    db_session.flush()
    db_session.refresh(notification)

    assert notification.id is not None
    assert notification.user_id == notification_user.id
    assert notification.event_type == "REEVALUATION_REMINDER"
    assert notification.channel == NotificationChannel.IN_APP
    assert notification.status == NotificationStatus.PENDING
    assert notification.sent_at is None
    assert notification.read_at is None
    assert notification.created_at is not None
    assert notification.updated_at is not None


def test_duplicate_notification_rejected(
    db_session,
    notification_user,
):
    first = create_notification(notification_user.id)

    db_session.add(first)
    db_session.flush()

    second = create_notification(notification_user.id)

    db_session.add(second)

    with pytest.raises(IntegrityError):
        db_session.flush()


def test_notification_channels_are_independent(
    db_session,
    notification_user,
):
    for channel in (
        NotificationChannel.IN_APP,
        NotificationChannel.EMAIL,
    ):
        db_session.add(
            create_notification(
                notification_user.id,
                channel=channel,
            )
        )

    db_session.flush()

    notifications = (
        db_session.query(Notification)
        .filter(Notification.user_id == notification_user.id)
        .all()
    )

    assert len(notifications) == 2
    assert {notification.channel for notification in notifications} == {
        NotificationChannel.IN_APP,
        NotificationChannel.EMAIL,
    }


@pytest.mark.parametrize(
    "invalid_channel",
    ["INVALID", "SMS"],
)
def test_invalid_notification_channel_rejected(
    db_session,
    notification_user,
    invalid_channel,
):
    notification = create_notification(
        notification_user.id,
        channel=invalid_channel,
    )

    db_session.add(notification)

    with pytest.raises((StatementError, IntegrityError)):
        db_session.flush()


def test_invalid_notification_status_rejected(
    db_session,
    notification_user,
):
    notification = create_notification(
        notification_user.id,
        status="INVALID",
    )

    db_session.add(notification)

    with pytest.raises((StatementError, IntegrityError)):
        db_session.flush()


def test_notification_can_be_marked_as_read(
    db_session,
    notification_user,
):
    notification = create_notification(notification_user.id)

    db_session.add(notification)
    db_session.flush()

    assert notification.read_at is None

    read_at = datetime.now(timezone.utc)

    notification.read_at = read_at
    notification.status = NotificationStatus.SENT

    db_session.flush()
    db_session.refresh(notification)

    assert notification.read_at == read_at
    assert notification.status == NotificationStatus.SENT
