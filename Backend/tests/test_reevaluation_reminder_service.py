
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
