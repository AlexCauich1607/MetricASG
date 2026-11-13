import pytest

from app.main import app
from app.models.notification_event_preference_model import (
    NotificationEventPreference,
)
from app.models.notification_event_preference_request import (
    NotificationEventType,
)
from app.models.user_model import User
from app.services.token_service import get_current_user


BASE_URL = "/api/notifications/preferences/me/events"
EVENT = "IMPROVEMENT_ACTION_DUE"


@pytest.fixture
def preference_api_users(db_session):
    users = []

    for number in (1, 2):
        user = User(
            name=f"Preference API User {number}",
            company_name="Test Company",
            email=f"preference-api-{number}@example.com",
            password="test-password-hash",
        )
        db_session.add(user)
        users.append(user)

    db_session.flush()
    return users


def authenticate(user):
    app.dependency_overrides[get_current_user] = lambda: user


def test_event_preferences_require_authentication(client):
    response = client.get(BASE_URL)
    assert response.status_code == 401

    response = client.put(
        f"{BASE_URL}/{EVENT}",
        json={
            "in_app_enabled": False,
            "email_enabled": True,
        },
    )
    assert response.status_code == 401


def test_default_event_preferences(
    client,
    db_session,
    preference_api_users,
):
    authenticate(preference_api_users[0])

    response = client.get(BASE_URL)

    assert response.status_code == 200, response.text

    data = response.json()

    assert len(data) == len(NotificationEventType)
    assert {item["event_type"] for item in data} == {
        event.value for event in NotificationEventType
    }

    assert all(
        item["in_app_enabled"] is True
        and item["email_enabled"] is True
        for item in data
    )

    assert db_session.query(NotificationEventPreference).count() == 0


def test_update_event_preference(
    client,
    db_session,
    preference_api_users,
):
    user = preference_api_users[0]
    authenticate(user)

    payload = {
        "in_app_enabled": False,
        "email_enabled": True,
    }

    response = client.put(
        f"{BASE_URL}/{EVENT}",
        json=payload,
    )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "event_type": EVENT,
        **payload,
    }

    preference = (
        db_session.query(NotificationEventPreference)
        .filter_by(user_id=user.id, event_type=EVENT)
        .one()
    )

    assert preference.in_app_enabled is False
    assert preference.email_enabled is True

    response = client.get(BASE_URL)

    assert response.status_code == 200

    saved = next(
        item for item in response.json()
        if item["event_type"] == EVENT
    )

    assert saved["in_app_enabled"] is False
    assert saved["email_enabled"] is True


def test_updating_event_does_not_create_duplicates(
    client,
    db_session,
    preference_api_users,
):
    user = preference_api_users[0]
    authenticate(user)

    for enabled in (False, True):
        response = client.put(
            f"{BASE_URL}/{EVENT}",
            json={
                "in_app_enabled": enabled,
                "email_enabled": True,
            },
        )
        assert response.status_code == 200, response.text

    preferences = (
        db_session.query(NotificationEventPreference)
        .filter_by(user_id=user.id, event_type=EVENT)
        .all()
    )

    assert len(preferences) == 1
    assert preferences[0].in_app_enabled is True


def test_invalid_event_rejected(
    client,
    preference_api_users,
):
    authenticate(preference_api_users[0])

    response = client.put(
        f"{BASE_URL}/UNKNOWN_EVENT",
        json={
            "in_app_enabled": True,
            "email_enabled": False,
        },
    )

    assert response.status_code == 422


def test_invalid_preference_payload_rejected(
    client,
    preference_api_users,
):
    authenticate(preference_api_users[0])

    response = client.put(
        f"{BASE_URL}/{EVENT}",
        json={
            "in_app_enabled": "not-a-boolean",
            "email_enabled": True,
        },
    )

    assert response.status_code == 422


def test_event_preferences_are_isolated_by_user(
    client,
    db_session,
    preference_api_users,
):
    first_user, second_user = preference_api_users

    authenticate(first_user)

    response = client.put(
        f"{BASE_URL}/{EVENT}",
        json={
            "in_app_enabled": False,
            "email_enabled": False,
        },
    )

    assert response.status_code == 200, response.text

    authenticate(second_user)

    response = client.get(BASE_URL)

    assert response.status_code == 200

    event = next(
        item for item in response.json()
        if item["event_type"] == EVENT
    )

    assert event["in_app_enabled"] is True
    assert event["email_enabled"] is True

    records = db_session.query(NotificationEventPreference).all()

    assert len(records) == 1
    assert records[0].user_id == first_user.id
