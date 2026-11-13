import pytest

from app.models.notification_event_preference_model import (
    NotificationEventPreference,
)
from app.models.notification_model import NotificationChannel
from app.models.notification_preference_model import (
    NotificationPreference,
)
from app.models.user_model import User
from app.services.notification_preference_service import (
    NotificationPreferenceService,
)


EVENT_TYPE = "IMPROVEMENT_ACTION_DUE"


@pytest.fixture
def preference_user(db_session):
    user = User(
        name="Preference Test",
        company_name="Test Company",
        email="event-preference-test@example.com",
        password="test-password-hash",
    )

    db_session.add(user)
    db_session.flush()

    return user


def test_preferences_enabled_by_default(
    db_session,
    preference_user,
):
    service = NotificationPreferenceService(db_session)

    for channel in NotificationChannel:
        assert service.is_enabled(
            preference_user.id,
            EVENT_TYPE,
            channel,
        ) is True


@pytest.mark.parametrize(
    "global_enabled,event_enabled,expected",
    [
        (True, True, True),
        (True, False, False),
        (False, True, False),
        (False, False, False),
    ],
)
def test_global_and_event_preferences(
    db_session,
    preference_user,
    global_enabled,
    event_enabled,
    expected,
):
    db_session.add(
        NotificationPreference(
            user_id=preference_user.id,
            in_app_enabled=global_enabled,
            email_enabled=True,
        )
    )

    db_session.add(
        NotificationEventPreference(
            user_id=preference_user.id,
            event_type=EVENT_TYPE,
            in_app_enabled=event_enabled,
            email_enabled=True,
        )
    )

    db_session.flush()

    service = NotificationPreferenceService(db_session)

    assert service.is_enabled(
        preference_user.id,
        EVENT_TYPE,
        NotificationChannel.IN_APP,
    ) is expected


def test_email_and_internal_preferences_are_independent(
    db_session,
    preference_user,
):
    db_session.add(
        NotificationEventPreference(
            user_id=preference_user.id,
            event_type=EVENT_TYPE,
            in_app_enabled=False,
            email_enabled=True,
        )
    )

    db_session.flush()

    service = NotificationPreferenceService(db_session)

    assert service.is_enabled(
        preference_user.id,
        EVENT_TYPE,
        NotificationChannel.IN_APP,
    ) is False

    assert service.is_enabled(
        preference_user.id,
        EVENT_TYPE,
        NotificationChannel.EMAIL,
    ) is True


def test_event_preferences_are_independent(
    db_session,
    preference_user,
):
    db_session.add(
        NotificationEventPreference(
            user_id=preference_user.id,
            event_type=EVENT_TYPE,
            in_app_enabled=False,
            email_enabled=False,
        )
    )

    db_session.flush()

    service = NotificationPreferenceService(db_session)

    assert service.is_enabled(
        preference_user.id,
        EVENT_TYPE,
        NotificationChannel.IN_APP,
    ) is False

    assert service.is_enabled(
        preference_user.id,
        "COMPANY_INVITATION_CREATED",
        NotificationChannel.IN_APP,
    ) is True


def test_invalid_channel_rejected(
    db_session,
    preference_user,
):
    service = NotificationPreferenceService(db_session)

    with pytest.raises(ValueError):
        service.is_enabled(
            preference_user.id,
            EVENT_TYPE,
            "SMS",
        )
