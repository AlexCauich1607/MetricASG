from app.core.roles import UserRole
from app.models.user_model import User
from app.services.auth_service import AuthService


TEST_PASSWORD = "Password123!"


def create_authorization_user(db_session, email, role):
    auth_service = AuthService()

    user = User(
        name="Authorization",
        lastname="Test",
        position="Tester",
        company_name="Authorization Test Company",
        email=email,
        phone="9999999999",
        password=auth_service.hash_password(TEST_PASSWORD),
        role=role,
        active=True,
    )

    db_session.add(user)
    db_session.flush()

    return user


def login(client, email):
    response = client.post(
        "/api/auth/login",
        json={
            "email": email,
            "password": TEST_PASSWORD,
        },
    )

    assert response.status_code == 200

    return response.json()["access_token"]


def auth_headers(token):
    return {
        "Authorization": f"Bearer {token}"
    }


def test_user_cannot_access_admin_users_endpoint(client, db_session):
    user = create_authorization_user(
        db_session,
        "authorization-user@test.local",
        UserRole.USER,
    )

    token = login(client, user.email)

    response = client.get(
        "/api/users/",
        headers=auth_headers(token),
    )

    assert response.status_code == 403


def test_user_cannot_create_user(client, db_session):
    user = create_authorization_user(
        db_session,
        "authorization-create@test.local",
        UserRole.USER,
    )

    token = login(client, user.email)

    response = client.post(
        "/api/users/",
        headers=auth_headers(token),
        json={},
    )

    assert response.status_code == 403


def test_user_cannot_update_user(client, db_session):
    user = create_authorization_user(
        db_session,
        "authorization-update@test.local",
        UserRole.USER,
    )

    token = login(client, user.email)

    response = client.put(
        f"/api/users/{user.id}",
        headers=auth_headers(token),
        json={},
    )

    assert response.status_code == 403


def test_user_cannot_delete_user(client, db_session):
    user = create_authorization_user(
        db_session,
        "authorization-delete@test.local",
        UserRole.USER,
    )

    token = login(client, user.email)

    response = client.delete(
        f"/api/users/{user.id}",
        headers=auth_headers(token),
    )

    assert response.status_code == 403


def test_admin_can_access_another_user(client, db_session):
    admin = create_authorization_user(
        db_session,
        "authorization-admin@test.local",
        UserRole.ADMIN,
    )

    target = create_authorization_user(
        db_session,
        "authorization-target@test.local",
        UserRole.USER,
    )

    token = login(client, admin.email)

    response = client.get(
        f"/api/users/{target.id}",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["id"] == target.id
    assert response.json()["email"] == target.email
    assert "password" not in response.json()


def test_user_cannot_access_another_user(client, db_session):
    user = create_authorization_user(
        db_session,
        "authorization-owner@test.local",
        UserRole.USER,
    )

    target = create_authorization_user(
        db_session,
        "authorization-other@test.local",
        UserRole.USER,
    )

    token = login(client, user.email)

    response = client.get(
        f"/api/users/{target.id}",
        headers=auth_headers(token),
    )

    assert response.status_code == 403


def test_user_can_access_own_profile(client, db_session):
    user = create_authorization_user(
        db_session,
        "authorization-profile@test.local",
        UserRole.USER,
    )

    token = login(client, user.email)

    response = client.get(
        "/api/users/profile/me",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["id"] == user.id
    assert response.json()["email"] == user.email
    assert "password" not in response.json()


def test_profile_ignores_manipulated_user_id(client, db_session):
    user = create_authorization_user(
        db_session,
        "authorization-owner-update@test.local",
        UserRole.USER,
    )

    target = create_authorization_user(
        db_session,
        "authorization-target-update@test.local",
        UserRole.USER,
    )

    token = login(client, user.email)

    response = client.put(
        "/api/users/profile/me",
        headers=auth_headers(token),
        json={
            "id": target.id,
            "name": "Updated Own Profile",
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == user.id
    assert response.json()["name"] == "Updated Own Profile"

    db_session.refresh(user)
    db_session.refresh(target)

    assert user.name == "Updated Own Profile"
    assert target.name == "Authorization"