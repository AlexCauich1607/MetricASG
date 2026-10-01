from jose import jwt

from app.core.config import settings
from app.models.refresh_session_model import RefreshSession
from app.models.user_model import User
from app.services.auth_service import AuthService
from app.core.roles import UserRole


TEST_EMAIL = "auth-test@test.local"
TEST_PASSWORD = "Password123!"


def create_test_user(db_session, email=TEST_EMAIL):
    auth_service = AuthService()

    user = User(
        name="Auth",
        lastname="Test",
        position="Tester",
        company_name="Auth Test Company",
        email=email,
        phone="9999999999",
        password=auth_service.hash_password(TEST_PASSWORD),
        role=UserRole.USER,
        active=True,
    )

    db_session.add(user)
    db_session.flush()

    return user


def test_login_success(client, db_session):
    user = create_test_user(db_session)

    response = client.post(
        "/api/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "refresh_token" not in data

    assert data["user"]["id"] == user.id
    assert data["user"]["email"] == TEST_EMAIL

    refresh_token = client.cookies.get("refresh_token")

    assert refresh_token is not None

    refresh_session = (
        db_session.query(RefreshSession)
        .filter(RefreshSession.user_id == user.id)
        .one()
    )

    assert refresh_session.revoked_at is None


def test_login_user_not_found(client):
    response = client.post(
        "/api/auth/login",
        json={
            "email": "nonexistent@test.local",
            "password": TEST_PASSWORD,
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"


def test_login_incorrect_password(client, db_session):
    create_test_user(db_session)

    response = client.post(
        "/api/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": "WrongPassword123!",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect password"


def test_refresh_token_success_and_rotation(client, db_session):
    user = create_test_user(db_session)

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        },
    )

    assert login_response.status_code == 200

    old_refresh_token = client.cookies.get("refresh_token")

    assert old_refresh_token is not None

    old_payload = jwt.decode(
        old_refresh_token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )

    old_jti = old_payload["jti"]

    response = client.post("/api/auth/refresh-token")

    assert response.status_code == 200

    data = response.json()

    assert "token" in data
    assert "refresh_token" not in data

    new_refresh_token = client.cookies.get("refresh_token")

    assert new_refresh_token is not None
    assert new_refresh_token != old_refresh_token

    new_payload = jwt.decode(
        new_refresh_token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )

    assert new_payload["jti"] != old_jti
    assert int(new_payload["id"]) == user.id

    old_session = (
        db_session.query(RefreshSession)
        .filter(RefreshSession.jti == old_jti)
        .one()
    )

    assert old_session.revoked_at is not None

    new_session = (
        db_session.query(RefreshSession)
        .filter(RefreshSession.jti == new_payload["jti"])
        .one()
    )

    assert new_session.user_id == user.id
    assert new_session.revoked_at is None


def test_refresh_token_without_cookie(client):
    response = client.post("/api/auth/refresh-token")

    assert response.status_code == 401
    assert response.json()["detail"] == "No refresh token"


def test_logout_revokes_refresh_session(client, db_session):
    user = create_test_user(db_session)

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        },
    )

    assert login_response.status_code == 200

    refresh_token = client.cookies.get("refresh_token")

    assert refresh_token is not None

    payload = jwt.decode(
        refresh_token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )

    jti = payload["jti"]

    response = client.post("/api/auth/logout")

    assert response.status_code == 200
    assert response.json() == {"success": True}

    refresh_session = (
        db_session.query(RefreshSession)
        .filter(RefreshSession.jti == jti)
        .one()
    )

    assert refresh_session.user_id == user.id
    assert refresh_session.revoked_at is not None


def test_revoked_refresh_token_is_rejected(client, db_session):
    create_test_user(db_session)

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        },
    )

    assert login_response.status_code == 200

    refresh_token = client.cookies.get("refresh_token")

    assert refresh_token is not None

    logout_response = client.post("/api/auth/logout")

    assert logout_response.status_code == 200

    # Restore the revoked token manually so the refresh endpoint
    # receives it and can verify that the session was revoked.
    client.cookies.set(
        "refresh_token",
        refresh_token,
    )

    response = client.post("/api/auth/refresh-token")

    assert response.status_code == 401
    assert response.json()["detail"] == "Refresh session revoked"