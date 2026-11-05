
from datetime import date, datetime
from unittest.mock import MagicMock, patch

from app.models.reevaluation_reminder_model import (
    ReevaluationReminder,
    ReminderChannel,
    ReminderStatus,
    ReminderType,
)
from app.services.reevaluation_reminder_delivery_service import (
    ReevaluationReminderDeliveryService,
)
from tests.test_evaluation import create_evaluation_data


from datetime import timedelta

from app.models.notification_preference_model import (
    NotificationPreference,
)

TEST_DATE = date(2026, 11, 5)
TARGET_DATE = date(2026, 12, 5)


def create_pending_email(db_session):
    data = create_evaluation_data(db_session)
    user = data["user"]

    user.active = True
    user.next_evaluation = datetime(2026, 12, 5)

    reminder = ReevaluationReminder(
        user_id=user.id,
        target_date=TARGET_DATE,
        reminder_type=ReminderType.FIRST,
        channel=ReminderChannel.EMAIL,
        status=ReminderStatus.PENDING,
    )

    db_session.add(reminder)
    db_session.flush()

    return user, reminder


def test_delivery_sends_pending_email(db_session):
    user, reminder = create_pending_email(db_session)

    email_service = MagicMock()

    service = ReevaluationReminderDeliveryService(
        db_session,
        email_service=email_service,
    )

    with patch(
        "app.services.reevaluation_reminder_delivery_service.settings.smtp_enabled",
        True,
    ):
        result = service.deliver_pending(today=TEST_DATE)

    assert result == {
        "sent": 1,
        "failed": 0,
        "cancelled": 0,
    }

    email_service.send.assert_called_once()

    args = email_service.send.call_args.args

    assert args[0] == user.email
    assert args[1].id == reminder.id

    db_session.refresh(reminder)

    assert reminder.status == ReminderStatus.SENT
    assert reminder.sent_at is not None


def test_delivery_marks_smtp_failure(db_session):
    _, reminder = create_pending_email(db_session)

    email_service = MagicMock()
    email_service.send.side_effect = ConnectionError(
        "SMTP unavailable"
    )

    service = ReevaluationReminderDeliveryService(
        db_session,
        email_service=email_service,
    )

    with patch(
        "app.services.reevaluation_reminder_delivery_service.settings.smtp_enabled",
        True,
    ):
        result = service.deliver_pending(today=TEST_DATE)

    assert result == {
        "sent": 0,
        "failed": 1,
        "cancelled": 0,
    }

    db_session.refresh(reminder)

    assert reminder.status == ReminderStatus.FAILED
    assert reminder.sent_at is None


def test_delivery_does_not_send_when_smtp_disabled(db_session):
    _, reminder = create_pending_email(db_session)

    email_service = MagicMock()

    service = ReevaluationReminderDeliveryService(
        db_session,
        email_service=email_service,
    )

    with patch(
        "app.services.reevaluation_reminder_delivery_service.settings.smtp_enabled",
        False,
    ):
        result = service.deliver_pending(today=TEST_DATE)

    assert result == {
        "sent": 0,
        "failed": 0,
        "cancelled": 0,
    }

    email_service.send.assert_not_called()

    db_session.refresh(reminder)

    assert reminder.status == ReminderStatus.PENDING


def test_delivery_does_not_send_twice(db_session):
    _, reminder = create_pending_email(db_session)

    email_service = MagicMock()

    service = ReevaluationReminderDeliveryService(
        db_session,
        email_service=email_service,
    )

    with patch(
        "app.services.reevaluation_reminder_delivery_service.settings.smtp_enabled",
        True,
    ):
        first_result = service.deliver_pending(today=TEST_DATE)
        second_result = service.deliver_pending(today=TEST_DATE)

    assert first_result["sent"] == 1
    assert second_result["sent"] == 0

    email_service.send.assert_called_once()

    db_session.refresh(reminder)

    assert reminder.status == ReminderStatus.SENT

def test_delivery_cancels_previous_evaluation_cycle(db_session):
    user, reminder = create_pending_email(db_session)

    # El usuario completó otra evaluación y cambió su fecha.
    user.next_evaluation = datetime(2027, 6, 5)
    db_session.flush()

    email_service = MagicMock()

    service = ReevaluationReminderDeliveryService(
        db_session,
        email_service=email_service,
    )

    with patch(
        "app.services.reevaluation_reminder_delivery_service.settings.smtp_enabled",
        True,
    ):
        result = service.deliver_pending(today=TEST_DATE)

    assert result["cancelled"] == 1

    email_service.send.assert_not_called()

    db_session.refresh(reminder)

    assert reminder.status == ReminderStatus.CANCELLED


def test_delivery_cancels_outdated_reminder(db_session):
    _, reminder = create_pending_email(db_session)

    email_service = MagicMock()

    service = ReevaluationReminderDeliveryService(
        db_session,
        email_service=email_service,
    )

    with patch(
        "app.services.reevaluation_reminder_delivery_service.settings.smtp_enabled",
        True,
    ):
        result = service.deliver_pending(
            today=TEST_DATE + timedelta(days=1)
        )

    assert result["cancelled"] == 1

    email_service.send.assert_not_called()

    db_session.refresh(reminder)

    assert reminder.status == ReminderStatus.CANCELLED


def test_delivery_respects_disabled_email_preference(db_session):
    user, reminder = create_pending_email(db_session)

    db_session.add(
        NotificationPreference(
            user_id=user.id,
            in_app_enabled=True,
            email_enabled=False,
        )
    )
    db_session.flush()

    email_service = MagicMock()

    service = ReevaluationReminderDeliveryService(
        db_session,
        email_service=email_service,
    )

    with patch(
        "app.services.reevaluation_reminder_delivery_service.settings.smtp_enabled",
        True,
    ):
        result = service.deliver_pending(today=TEST_DATE)

    assert result["cancelled"] == 1

    email_service.send.assert_not_called()

    db_session.refresh(reminder)

    assert reminder.status == ReminderStatus.CANCELLED


def test_delivery_cancels_inactive_user(db_session):
    user, reminder = create_pending_email(db_session)

    user.active = False
    db_session.flush()

    email_service = MagicMock()

    service = ReevaluationReminderDeliveryService(
        db_session,
        email_service=email_service,
    )

    with patch(
        "app.services.reevaluation_reminder_delivery_service.settings.smtp_enabled",
        True,
    ):
        result = service.deliver_pending(today=TEST_DATE)

    assert result["cancelled"] == 1

    email_service.send.assert_not_called()

    db_session.refresh(reminder)

    assert reminder.status == ReminderStatus.CANCELLED
