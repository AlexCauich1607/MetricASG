
from datetime import date

import pytest

from app.main import app
from app.models.notification_preference_model import NotificationPreference
from app.models.reevaluation_reminder_model import (
    ReevaluationReminder,
    ReminderChannel,
    ReminderType,
)
from app.services.token_service import get_current_user
from tests.test_evaluation import create_evaluation_data
from datetime import date, datetime

@pytest.fixture
def notification_user(db_session):
    data = create_evaluation_data(db_session)
    return data["user"]


def test_notifications_require_authentication(client):
    response = client.get("/api/notifications/me")

    assert response.status_code == 401


def test_preferences_require_authentication(client):
    response = client.get("/api/notifications/preferences/me")

    assert response.status_code == 401


def test_get_default_notification_preferences(
    client,
    notification_user,
):
    app.dependency_overrides[get_current_user] = (
        lambda: notification_user
    )

    response = client.get("/api/notifications/preferences/me")

    assert response.status_code == 200
    assert response.json() == {
        "in_app_enabled": True,
        "email_enabled": True,
    }


def test_update_notification_preferences(
    client,
    db_session,
    notification_user,
):
    app.dependency_overrides[get_current_user] = (
        lambda: notification_user
    )

    response = client.put(
        "/api/notifications/preferences/me",
        json={
            "in_app_enabled": True,
            "email_enabled": False,
        },
    )

    assert response.status_code == 200, response.text

    assert response.json() == {
        "in_app_enabled": True,
        "email_enabled": False,
    }

    preference = (
        db_session.query(NotificationPreference)
        .filter(
            NotificationPreference.user_id == notification_user.id
        )
        .one()
    )

    assert preference.email_enabled is False

    response = client.get("/api/notifications/preferences/me")

    assert response.status_code == 200
    assert response.json()["email_enabled"] is False


def test_get_only_internal_notifications(
    client,
    db_session,
    notification_user,
):
    app.dependency_overrides[get_current_user] = (
        lambda: notification_user
    )

    notification_user.active = True
    notification_user.next_evaluation = datetime(2027, 5, 5)
    db_session.flush()

    internal = ReevaluationReminder(
        user_id=notification_user.id,
        target_date=date(2027, 5, 5),
        reminder_type=ReminderType.FIRST,
        channel=ReminderChannel.IN_APP,
    )

    email = ReevaluationReminder(
        user_id=notification_user.id,
        target_date=date(2027, 5, 5),
        reminder_type=ReminderType.FIRST,
        channel=ReminderChannel.EMAIL,
    )

    db_session.add_all([internal, email])
    db_session.flush()

    response = client.get("/api/notifications/me")

    assert response.status_code == 200, response.text

    notifications = response.json()

    assert len(notifications) == 1
    assert notifications[0]["id"] == internal.id
    assert notifications[0]["reminder_type"] == "FIRST"


def test_notifications_are_isolated_by_user(
    client,
    db_session,
    notification_user,
):
    from app.models.user_model import User

    other_user = User(
        name="Other User",
        company_name="Other Company",
        email="other-notification-user@example.com",
        password="test-password-hash",
    )

    db_session.add(other_user)
    db_session.flush()

    db_session.add(
        ReevaluationReminder(
            user_id=other_user.id,
            target_date=date(2027, 5, 5),
            reminder_type=ReminderType.DUE,
            channel=ReminderChannel.IN_APP,
        )
    )
    db_session.flush()

    app.dependency_overrides[get_current_user] = (
        lambda: notification_user
    )

    response = client.get("/api/notifications/me")

    assert response.status_code == 200
    assert response.json() == []


def test_previous_cycle_notifications_are_hidden(
    client,
    db_session,
    notification_user,
):
    app.dependency_overrides[get_current_user] = (
        lambda: notification_user
    )

    notification_user.active = True
    notification_user.next_evaluation = datetime(2027, 11, 5)

    previous_reminder = ReevaluationReminder(
        user_id=notification_user.id,
        target_date=date(2027, 5, 5),
        reminder_type=ReminderType.DUE,
        channel=ReminderChannel.IN_APP,
    )

    db_session.add(previous_reminder)
    db_session.flush()

    response = client.get("/api/notifications/me")

    assert response.status_code == 200
    assert response.json() == []
