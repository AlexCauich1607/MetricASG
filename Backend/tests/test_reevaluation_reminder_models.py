from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError, StatementError

from app.models.notification_preference_model import NotificationPreference
from app.models.reevaluation_reminder_model import (
    ReevaluationReminder,
    ReminderChannel,
    ReminderStatus,
    ReminderType,
)
from app.models.user_model import User


@pytest.fixture
def reminder_user(db_session):
    user = User(
        name="Reminder Test",
        company_name="Test Company",
        email="reminder-test@example.com",
        password="test-password-hash",
    )

    db_session.add(user)
    db_session.flush()

    return user


def test_notification_preferences_defaults(db_session, reminder_user):
    preference = NotificationPreference(
        user_id=reminder_user.id,
    )

    db_session.add(preference)
    db_session.flush()
    db_session.refresh(preference)

    assert preference.in_app_enabled is True
    assert preference.email_enabled is True


def test_notification_preferences_unique_per_user(
    db_session,
    reminder_user,
):
    first = NotificationPreference(user_id=reminder_user.id)

    db_session.add(first)
    db_session.flush()

    second = NotificationPreference(user_id=reminder_user.id)

    db_session.add(second)

    with pytest.raises(IntegrityError):
        db_session.flush()


def test_create_reevaluation_reminder(db_session, reminder_user):
    reminder = ReevaluationReminder(
        user_id=reminder_user.id,
        target_date=date(2027, 5, 5),
        reminder_type=ReminderType.FIRST,
        channel=ReminderChannel.IN_APP,
    )

    db_session.add(reminder)
    db_session.flush()
    db_session.refresh(reminder)

    assert reminder.id is not None
    assert reminder.status == ReminderStatus.PENDING
    assert reminder.sent_at is None


def test_duplicate_reevaluation_reminder_rejected(
    db_session,
    reminder_user,
):
    reminder_data = {
        "user_id": reminder_user.id,
        "target_date": date(2027, 5, 5),
        "reminder_type": ReminderType.FIRST,
        "channel": ReminderChannel.IN_APP,
    }

    db_session.add(ReevaluationReminder(**reminder_data))
    db_session.flush()

    db_session.add(ReevaluationReminder(**reminder_data))

    with pytest.raises(IntegrityError):
        db_session.flush()


def test_reminder_channels_are_independent(
    db_session,
    reminder_user,
):
    for channel in (ReminderChannel.IN_APP, ReminderChannel.EMAIL):
        db_session.add(
            ReevaluationReminder(
                user_id=reminder_user.id,
                target_date=date(2027, 5, 5),
                reminder_type=ReminderType.FIRST,
                channel=channel,
            )
        )

    db_session.flush()

    reminders = (
        db_session.query(ReevaluationReminder)
        .filter(ReevaluationReminder.user_id == reminder_user.id)
        .all()
    )

    assert len(reminders) == 2
    assert {reminder.channel for reminder in reminders} == {
        ReminderChannel.IN_APP,
        ReminderChannel.EMAIL,
    }


def test_invalid_reminder_status_rejected(
    db_session,
    reminder_user,
):
    reminder = ReevaluationReminder(
        user_id=reminder_user.id,
        target_date=date(2027, 5, 5),
        reminder_type=ReminderType.DUE,
        channel=ReminderChannel.EMAIL,
        status="INVALID",
    )

    db_session.add(reminder)

    with pytest.raises((StatementError, IntegrityError)):
        db_session.flush()
