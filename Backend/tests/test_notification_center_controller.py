import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.main import app
from app.models.notification_model import (
    Notification,
    NotificationChannel,
    NotificationStatus,
)
from app.models.user_model import User
from app.services.token_service import get_current_user


BASE_URL = "/api/notifications/me/center"


@pytest.fixture
def center_users(db_session):
    unique_id = uuid.uuid4().hex
    users = []

    for number in (1, 2):
        user = User(
            name=f"Notification Center User {number}",
            company_name="Test Company",
            email=f"notification-center-{number}-{unique_id}@test.local",
            password="test-password-hash",
        )
        db_session.add(user)
        users.append(user)

    db_session.flush()
    return users


def authenticate(user):
    app.dependency_overrides[get_current_user] = lambda: user


def create_notification(
    db_session,
    user_id,
    *,
    channel=NotificationChannel.IN_APP,
    status=NotificationStatus.PENDING,
    created_at=None,
):
    notification = Notification(
        user_id=user_id,
        event_type="IMPROVEMENT_ACTION_DUE",
        channel=channel,
        status=status,
        title="Action reminder",
        message="An improvement action needs attention.",
        deduplication_key=uuid.uuid4().hex,
    )

    if created_at is not None:
        notification.created_at = created_at

    db_session.add(notification)
    db_session.flush()

    return notification


def test_center_requires_authentication(client):
    response = client.get(BASE_URL)

    assert response.status_code == 401


def test_center_returns_empty_list(
    client,
    center_users,
):
    authenticate(center_users[0])

    response = client.get(BASE_URL)

    assert response.status_code == 200, response.text
    assert response.json() == []


def test_center_filters_user_channel_and_status(
    client,
    db_session,
    center_users,
):
    first_user, second_user = center_users

    valid_pending = create_notification(
        db_session,
        first_user.id,
        status=NotificationStatus.PENDING,
    )

    valid_sent = create_notification(
        db_session,
        first_user.id,
        status=NotificationStatus.SENT,
    )

    create_notification(
        db_session,
        first_user.id,
        channel=NotificationChannel.EMAIL,
    )

    create_notification(
        db_session,
        first_user.id,
        status=NotificationStatus.FAILED,
    )

    create_notification(
        db_session,
        first_user.id,
        status=NotificationStatus.CANCELLED,
    )

    create_notification(
        db_session,
        second_user.id,
    )

    authenticate(first_user)

    response = client.get(BASE_URL)

    assert response.status_code == 200, response.text

    returned_ids = {
        item["id"]
        for item in response.json()
    }

    assert returned_ids == {
        valid_pending.id,
        valid_sent.id,
    }


def test_center_orders_newest_first(
    client,
    db_session,
    center_users,
):
    user = center_users[0]
    now = datetime.now(timezone.utc)

    oldest = create_notification(
        db_session,
        user.id,
        created_at=now - timedelta(days=2),
    )

    newest = create_notification(
        db_session,
        user.id,
        created_at=now,
    )

    middle = create_notification(
        db_session,
        user.id,
        created_at=now - timedelta(days=1),
    )

    authenticate(user)

    response = client.get(BASE_URL)

    assert response.status_code == 200, response.text

    assert [item["id"] for item in response.json()] == [
        newest.id,
        middle.id,
        oldest.id,
    ]


def test_center_pagination(
    client,
    db_session,
    center_users,
):
    user = center_users[0]
    now = datetime.now(timezone.utc)

    notifications = [
        create_notification(
            db_session,
            user.id,
            created_at=now + timedelta(minutes=index),
        )
        for index in range(5)
    ]

    authenticate(user)

    response = client.get(
        BASE_URL,
        params={
            "limit": 2,
            "offset": 1,
        },
    )

    assert response.status_code == 200, response.text

    assert [item["id"] for item in response.json()] == [
        notifications[3].id,
        notifications[2].id,
    ]


@pytest.mark.parametrize(
    "params",
    [
        {"limit": 0},
        {"limit": 101},
        {"offset": -1},
        {"limit": "invalid"},
    ],
)
def test_center_rejects_invalid_pagination(
    client,
    center_users,
    params,
):
    authenticate(center_users[0])

    response = client.get(
        BASE_URL,
        params=params,
    )

    assert response.status_code == 422


UNREAD_URL = "/api/notifications/me/unread-count"


def test_unread_count_requires_authentication(client):
    response = client.get(UNREAD_URL)

    assert response.status_code == 401


def test_unread_count_returns_zero(
    client,
    center_users,
):
    authenticate(center_users[0])

    response = client.get(UNREAD_URL)

    assert response.status_code == 200, response.text
    assert response.json() == {"unread_count": 0}


def test_unread_count_filters_channel_status_and_read_at(
    client,
    db_session,
    center_users,
):
    first_user, second_user = center_users

    create_notification(
        db_session,
        first_user.id,
        status=NotificationStatus.PENDING,
    )

    create_notification(
        db_session,
        first_user.id,
        status=NotificationStatus.SENT,
    )

    read_notification = create_notification(
        db_session,
        first_user.id,
        status=NotificationStatus.SENT,
    )

    read_notification.read_at = datetime.now(timezone.utc)

    create_notification(
        db_session,
        first_user.id,
        channel=NotificationChannel.EMAIL,
    )

    create_notification(
        db_session,
        first_user.id,
        status=NotificationStatus.FAILED,
    )

    create_notification(
        db_session,
        first_user.id,
        status=NotificationStatus.CANCELLED,
    )

    create_notification(
        db_session,
        second_user.id,
    )

    db_session.flush()

    authenticate(first_user)

    response = client.get(UNREAD_URL)

    assert response.status_code == 200, response.text
    assert response.json() == {"unread_count": 2}


def test_unread_count_isolated_by_user(
    client,
    db_session,
    center_users,
):
    first_user, second_user = center_users

    create_notification(
        db_session,
        first_user.id,
    )

    create_notification(
        db_session,
        first_user.id,
    )

    create_notification(
        db_session,
        second_user.id,
    )

    authenticate(first_user)

    first_response = client.get(UNREAD_URL)

    assert first_response.status_code == 200
    assert first_response.json() == {"unread_count": 2}

    authenticate(second_user)

    second_response = client.get(UNREAD_URL)

    assert second_response.status_code == 200
    assert second_response.json() == {"unread_count": 1}


def test_mark_read_requires_authentication(client):
    response = client.patch(
        "/api/notifications/me/1/read"
    )

    assert response.status_code == 401


def test_mark_notification_as_read(
    client,
    db_session,
    center_users,
):
    user = center_users[0]

    notification = create_notification(
        db_session,
        user.id,
    )

    notification_id = notification.id

    authenticate(user)

    response = client.patch(
        f"/api/notifications/me/{notification_id}/read"
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert data["id"] == notification_id
    assert data["read_at"] is not None

    db_session.refresh(notification)

    assert notification.read_at is not None

    count_response = client.get(
        "/api/notifications/me/unread-count"
    )

    assert count_response.status_code == 200
    assert count_response.json() == {
        "unread_count": 0
    }


def test_mark_read_is_idempotent(
    client,
    db_session,
    center_users,
):
    user = center_users[0]

    notification = create_notification(
        db_session,
        user.id,
    )

    authenticate(user)

    url = (
        f"/api/notifications/me/"
        f"{notification.id}/read"
    )

    first_response = client.patch(url)
    second_response = client.patch(url)

    assert first_response.status_code == 200
    assert second_response.status_code == 200

    assert (
        first_response.json()["read_at"]
        == second_response.json()["read_at"]
    )


def test_cannot_mark_another_users_notification(
    client,
    db_session,
    center_users,
):
    first_user, second_user = center_users

    notification = create_notification(
        db_session,
        second_user.id,
    )

    authenticate(first_user)

    response = client.patch(
        f"/api/notifications/me/{notification.id}/read"
    )

    assert response.status_code == 404

    db_session.refresh(notification)

    assert notification.read_at is None


@pytest.mark.parametrize(
    "channel,status",
    [
        (
            NotificationChannel.EMAIL,
            NotificationStatus.SENT,
        ),
        (
            NotificationChannel.IN_APP,
            NotificationStatus.FAILED,
        ),
        (
            NotificationChannel.IN_APP,
            NotificationStatus.CANCELLED,
        ),
    ],
)
def test_cannot_mark_hidden_notification_as_read(
    client,
    db_session,
    center_users,
    channel,
    status,
):
    user = center_users[0]

    notification = create_notification(
        db_session,
        user.id,
        channel=channel,
        status=status,
    )

    authenticate(user)

    response = client.patch(
        f"/api/notifications/me/{notification.id}/read"
    )

    assert response.status_code == 404

    db_session.refresh(notification)

    assert notification.read_at is None


def test_mark_nonexistent_notification_returns_404(
    client,
    center_users,
):
    authenticate(center_users[0])

    response = client.patch(
        "/api/notifications/me/999999999/read"
    )

    assert response.status_code == 404
