
from datetime import date, datetime, timedelta

import pytest

from app.models.evaluation_model import Evaluation, EvaluationStatus
from app.models.notification_preference_model import NotificationPreference
from app.models.reevaluation_reminder_model import (
    ReevaluationReminder,
    ReminderChannel,
    ReminderStatus,
    ReminderType,
)
from app.services.reevaluation_reminder_service import (
    ReevaluationReminderService,
)
from tests.test_evaluation import create_evaluation_data
from unittest.mock import patch
from zoneinfo import ZoneInfo


TODAY = date(2026, 11, 5)


@pytest.fixture
def reminder_data(db_session):
    data = create_evaluation_data(db_session)

    user = data["user"]
    user.active = True
    user.next_evaluation = datetime(2026, 12, 5)

    evaluation = Evaluation(
        user_id=user.id,
        company_id=data["company"].id,
        methodology_id=data["methodology"].id,
        status=EvaluationStatus.COMPLETED,
        date=datetime(2026, 6, 5),
    )

    db_session.add(evaluation)
    db_session.flush()

    return data


@pytest.mark.parametrize(
    ("days_until", "expected_type"),
    [
        (30, ReminderType.FIRST),
        (7, ReminderType.SECOND),
        (0, ReminderType.DUE),
    ],
)
def test_generates_reminders_on_scheduled_dates(
    db_session,
    reminder_data,
    days_until,
    expected_type,
):
    user = reminder_data["user"]
    user.next_evaluation = datetime.combine(
        TODAY + timedelta(days=days_until),
        datetime.min.time(),
    )
    db_session.flush()

    created = ReevaluationReminderService(db_session).generate(
        today=TODAY,
    )

    reminders = db_session.query(ReevaluationReminder).filter(
        ReevaluationReminder.user_id == user.id,
    ).all()

    assert created == 2
    assert len(reminders) == 2

    assert {r.channel for r in reminders} == {
        ReminderChannel.IN_APP,
        ReminderChannel.EMAIL,
    }

    assert all(r.reminder_type == expected_type for r in reminders)
    assert all(r.status == ReminderStatus.PENDING for r in reminders)


def test_does_not_generate_for_inactive_user(
    db_session,
    reminder_data,
):
    reminder_data["user"].active = False
    db_session.flush()

    created = ReevaluationReminderService(db_session).generate(TODAY)

    assert created == 0


def test_does_not_generate_without_completed_evaluation(
    db_session,
    reminder_data,
):
    db_session.query(Evaluation).filter(
        Evaluation.user_id == reminder_data["user"].id,
    ).update({"status": EvaluationStatus.DRAFT})

    db_session.flush()

    created = ReevaluationReminderService(db_session).generate(TODAY)

    assert created == 0


def test_respects_notification_preferences(
    db_session,
    reminder_data,
):
    preference = NotificationPreference(
        user_id=reminder_data["user"].id,
        in_app_enabled=True,
        email_enabled=False,
    )

    db_session.add(preference)
    db_session.flush()

    created = ReevaluationReminderService(db_session).generate(TODAY)

    reminders = db_session.query(ReevaluationReminder).filter(
        ReevaluationReminder.user_id == reminder_data["user"].id,
    ).all()

    assert created == 1
    assert len(reminders) == 1
    assert reminders[0].channel == ReminderChannel.IN_APP


def test_does_not_generate_duplicate_reminders(
    db_session,
    reminder_data,
):
    service = ReevaluationReminderService(db_session)

    first_execution = service.generate(TODAY)
    second_execution = service.generate(TODAY)

    assert first_execution == 2
    assert second_execution == 0

    reminders = db_session.query(ReevaluationReminder).filter(
        ReevaluationReminder.user_id == reminder_data["user"].id,
    ).all()

    assert len(reminders) == 2


def test_does_not_generate_outside_schedule(
    db_session,
    reminder_data,
):
    reminder_data["user"].next_evaluation = datetime(2026, 12, 10)
    db_session.flush()

    created = ReevaluationReminderService(db_session).generate(TODAY)

    assert created == 0


def test_does_not_generate_for_null_target_date(
    db_session,
    reminder_data,
):
    reminder_data["user"].next_evaluation = None
    db_session.flush()

    created = ReevaluationReminderService(db_session).generate(TODAY)

    assert created == 0

def test_cancels_obsolete_in_app_after_cycle_change(db_session):
    from tests.test_evaluation import create_evaluation_data

    data = create_evaluation_data(db_session)
    user = data["user"]

    user.active = True
    user.next_evaluation = datetime(2027, 11, 5)

    reminder = ReevaluationReminder(
        user_id=user.id,
        target_date=date(2027, 5, 5),
        reminder_type=ReminderType.DUE,
        channel=ReminderChannel.IN_APP,
        status=ReminderStatus.PENDING,
    )

    db_session.add(reminder)
    db_session.flush()

    service = ReevaluationReminderService(db_session)

    cancelled = service.cancel_obsolete_in_app()

    assert cancelled == 1

    db_session.refresh(reminder)
    assert reminder.status == ReminderStatus.CANCELLED


def test_cancels_in_app_when_preference_disabled(db_session):
    from tests.test_evaluation import create_evaluation_data

    data = create_evaluation_data(db_session)
    user = data["user"]

    user.active = True
    user.next_evaluation = datetime(2027, 5, 5)

    preference = NotificationPreference(
        user_id=user.id,
        in_app_enabled=False,
        email_enabled=True,
    )

    reminder = ReevaluationReminder(
        user_id=user.id,
        target_date=date(2027, 5, 5),
        reminder_type=ReminderType.FIRST,
        channel=ReminderChannel.IN_APP,
        status=ReminderStatus.PENDING,
    )

    db_session.add_all([preference, reminder])
    db_session.flush()

    service = ReevaluationReminderService(db_session)

    cancelled = service.cancel_obsolete_in_app()

    assert cancelled == 1

    db_session.refresh(reminder)
    assert reminder.status == ReminderStatus.CANCELLED


def test_keeps_valid_in_app_reminder(db_session):
    from tests.test_evaluation import create_evaluation_data

    data = create_evaluation_data(db_session)
    user = data["user"]

    user.active = True
    user.next_evaluation = datetime(2027, 5, 5)

    reminder = ReevaluationReminder(
        user_id=user.id,
        target_date=date(2027, 5, 5),
        reminder_type=ReminderType.FIRST,
        channel=ReminderChannel.IN_APP,
        status=ReminderStatus.PENDING,
    )

    db_session.add(reminder)
    db_session.flush()

    service = ReevaluationReminderService(db_session)

    cancelled = service.cancel_obsolete_in_app()

    assert cancelled == 0

    db_session.refresh(reminder)
    assert reminder.status == ReminderStatus.PENDING


@pytest.mark.parametrize(
    ("today", "target_date", "expected_type"),
    [
        (
            date(2026, 12, 2),
            date(2027, 1, 1),
            ReminderType.FIRST,
        ),
        (
            date(2026, 12, 25),
            date(2027, 1, 1),
            ReminderType.SECOND,
        ),
        (
            date(2028, 1, 30),
            date(2028, 2, 29),
            ReminderType.FIRST,
        ),
        (
            date(2028, 2, 22),
            date(2028, 2, 29),
            ReminderType.SECOND,
        ),
        (
            date(2028, 2, 29),
            date(2028, 2, 29),
            ReminderType.DUE,
        ),
        (
            date(2027, 4, 1),
            date(2027, 5, 1),
            ReminderType.FIRST,
        ),
    ],
)
def test_generates_reminders_across_calendar_boundaries(
    db_session,
    today,
    target_date,
    expected_type,
):
    from tests.test_evaluation import create_evaluation_data

    data = create_evaluation_data(db_session)
    user = data["user"]

    user.active = True
    user.next_evaluation = datetime.combine(
        target_date,
        datetime.min.time(),
    )

    evaluation = Evaluation(
        user_id=user.id,
        company_id=data["company"].id,
        methodology_id=data["methodology"].id,
        status=EvaluationStatus.COMPLETED,
        date=datetime(2026, 6, 5),
    )

    db_session.add(evaluation)
    db_session.flush()

    service = ReevaluationReminderService(db_session)

    created = service.generate(today=today)

    assert created == 2

    reminders = (
        db_session.query(ReevaluationReminder)
        .filter(
            ReevaluationReminder.user_id == user.id,
            ReevaluationReminder.target_date == target_date,
        )
        .all()
    )

    assert len(reminders) == 2

    assert {
        reminder.reminder_type
        for reminder in reminders
    } == {expected_type}

    assert {
        reminder.channel
        for reminder in reminders
    } == {
        ReminderChannel.IN_APP,
        ReminderChannel.EMAIL,
    }



@pytest.mark.parametrize(
    ("timezone_name", "utc_time", "expected_date"),
    [
        (
            "America/Merida",
            datetime(2026, 11, 6, 2, 0, tzinfo=ZoneInfo("UTC")),
            date(2026, 11, 5),
        ),
        (
            "Europe/Madrid",
            datetime(2026, 11, 5, 23, 30, tzinfo=ZoneInfo("UTC")),
            date(2026, 11, 6),
        ),
    ],
)
def test_reminder_generation_uses_local_date(
    db_session,
    timezone_name,
    utc_time,
    expected_date,
):
    from unittest.mock import Mock

    from app.services import reevaluation_reminder_service

    real_datetime = datetime

    datetime_mock = Mock(wraps=real_datetime)
    datetime_mock.now.side_effect = (
        lambda tz: utc_time.astimezone(tz)
    )

    with patch.object(
        reevaluation_reminder_service,
        "datetime",
        datetime_mock,
    ):
        service = ReevaluationReminderService(
            db_session,
            timezone=timezone_name,
        )

        # Sin usuarios elegibles, la generación debe terminar sin errores.
        result = service.generate()

    assert result == 0

    datetime_mock.now.assert_called_once_with(
        ZoneInfo(timezone_name)
    )

    assert utc_time.astimezone(
        ZoneInfo(timezone_name)
    ).date() == expected_date


# HU-042: integración con el centro de notificaciones.

from app.models.notification_model import (
    Notification,
    NotificationChannel,
)
from app.models.notification_event_preference_model import (
    NotificationEventPreference,
)


@pytest.mark.parametrize(
    "days_until",
    [30, 7, 0],
)
def test_reevaluation_creates_center_notifications(
    db_session,
    reminder_data,
    days_until,
):
    user = reminder_data["user"]

    target_date = TODAY + timedelta(days=days_until)
    user.next_evaluation = datetime.combine(
        target_date,
        datetime.min.time(),
    )

    db_session.flush()

    created = ReevaluationReminderService(db_session).generate(
        today=TODAY,
    )

    notifications = (
        db_session.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.event_type == "REEVALUATION_REMINDER",
        )
        .all()
    )

    assert created == 2
    assert len(notifications) == 2

    assert {item.channel for item in notifications} == {
        NotificationChannel.IN_APP,
        NotificationChannel.EMAIL,
    }

    assert all(
        target_date.isoformat() in item.message
        for item in notifications
    )

    assert all(
        item.read_at is None
        for item in notifications
    )


def test_reevaluation_notifications_are_idempotent(
    db_session,
    reminder_data,
):
    user = reminder_data["user"]
    service = ReevaluationReminderService(db_session)

    first_result = service.generate(today=TODAY)
    second_result = service.generate(today=TODAY)

    notifications = (
        db_session.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.event_type == "REEVALUATION_REMINDER",
        )
        .all()
    )

    reminders = (
        db_session.query(ReevaluationReminder)
        .filter(ReevaluationReminder.user_id == user.id)
        .all()
    )

    assert first_result == 2
    assert second_result == 0
    assert len(reminders) == 2
    assert len(notifications) == 2


def test_reevaluation_respects_event_preferences(
    db_session,
    reminder_data,
):
    user = reminder_data["user"]

    db_session.add(
        NotificationEventPreference(
            user_id=user.id,
            event_type="REEVALUATION_REMINDER",
            in_app_enabled=False,
            email_enabled=True,
        )
    )
    db_session.flush()

    created = ReevaluationReminderService(db_session).generate(
        today=TODAY,
    )

    reminders = (
        db_session.query(ReevaluationReminder)
        .filter(ReevaluationReminder.user_id == user.id)
        .all()
    )

    notifications = (
        db_session.query(Notification)
        .filter(Notification.user_id == user.id)
        .all()
    )

    assert created == 1
    assert len(reminders) == 1
    assert len(notifications) == 1

    assert reminders[0].channel == ReminderChannel.EMAIL
    assert notifications[0].channel == NotificationChannel.EMAIL


def test_reevaluation_disables_both_channels_by_event(
    db_session,
    reminder_data,
):
    user = reminder_data["user"]

    db_session.add(
        NotificationEventPreference(
            user_id=user.id,
            event_type="REEVALUATION_REMINDER",
            in_app_enabled=False,
            email_enabled=False,
        )
    )
    db_session.flush()

    created = ReevaluationReminderService(db_session).generate(
        today=TODAY,
    )

    assert created == 0

    assert (
        db_session.query(ReevaluationReminder)
        .filter(ReevaluationReminder.user_id == user.id)
        .count()
    ) == 0

    assert (
        db_session.query(Notification)
        .filter(Notification.user_id == user.id)
        .count()
    ) == 0


@pytest.mark.parametrize(
    "invalidating_change",
    ["cycle_changed", "event_disabled"],
)
def test_cancels_center_notification_with_obsolete_reminder(
    db_session,
    reminder_data,
    invalidating_change,
):
    from app.models.notification_model import NotificationStatus

    user = reminder_data["user"]

    service = ReevaluationReminderService(db_session)

    assert service.generate(today=TODAY) == 2

    reminder = (
        db_session.query(ReevaluationReminder)
        .filter(
            ReevaluationReminder.user_id == user.id,
            ReevaluationReminder.channel == ReminderChannel.IN_APP,
        )
        .one()
    )

    notification = (
        db_session.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.channel == NotificationChannel.IN_APP,
            Notification.event_type == "REEVALUATION_REMINDER",
        )
        .one()
    )

    assert reminder.status == ReminderStatus.PENDING
    assert notification.status == NotificationStatus.PENDING

    if invalidating_change == "cycle_changed":
        user.next_evaluation = datetime(2027, 6, 5)

    else:
        db_session.add(
            NotificationEventPreference(
                user_id=user.id,
                event_type="REEVALUATION_REMINDER",
                in_app_enabled=False,
                email_enabled=True,
            )
        )

    db_session.flush()

    cancelled = service.cancel_obsolete_in_app()

    assert cancelled == 1

    db_session.refresh(reminder)
    db_session.refresh(notification)

    assert reminder.status == ReminderStatus.CANCELLED
    assert notification.status == NotificationStatus.CANCELLED

    assert notification.read_at is None


def test_keeps_valid_center_notification(
    db_session,
    reminder_data,
):
    from app.models.notification_model import NotificationStatus

    user = reminder_data["user"]

    service = ReevaluationReminderService(db_session)

    assert service.generate(today=TODAY) == 2

    cancelled = service.cancel_obsolete_in_app()

    assert cancelled == 0

    reminder = (
        db_session.query(ReevaluationReminder)
        .filter(
            ReevaluationReminder.user_id == user.id,
            ReevaluationReminder.channel == ReminderChannel.IN_APP,
        )
        .one()
    )

    notification = (
        db_session.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.channel == NotificationChannel.IN_APP,
            Notification.event_type == "REEVALUATION_REMINDER",
        )
        .one()
    )

    assert reminder.status == ReminderStatus.PENDING
    assert notification.status == NotificationStatus.PENDING
