from app.core.roles import UserRole
from app.models.user_model import User
from app.services.auth_service import AuthService

import pytest
from uuid import uuid4

from app.core.roles import CompanyRole
from app.models.company_model import Company
from app.models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)

TEST_PASSWORD = "Password123!"


def create_authorization_user(db_session, email, role):
    auth_service = AuthService()

    user = User(
        name="Authorization",
        lastname="Test",
        position="Tester",
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

def test_delete_user_endpoint_is_not_available(client, db_session):
    admin = create_authorization_user(
        db_session,
        "authorization-delete-admin@test.local",
        UserRole.ADMIN,
    )

    target = create_authorization_user(
        db_session,
        "authorization-delete-target@test.local",
        UserRole.USER,
    )

    token = login(client, admin.email)

    response = client.delete(
        f"/api/users/{target.id}",
        headers=auth_headers(token),
    )

    assert response.status_code == 405

    db_session.refresh(target)

    assert target.id is not None
    assert target.active is True


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

def test_personal_user_without_company_can_access_profile(
    client,
    db_session,
):
    auth_service = AuthService()

    user = User(
        name="Personal",
        lastname="Account",
        position="Developer",
        email="personal-profile-no-company@test.local",
        phone="9999999999",
        password=auth_service.hash_password(TEST_PASSWORD),
        role=UserRole.USER,
        active=True,
    )

    db_session.add(user)
    db_session.flush()

    token = login(client, user.email)

    response = client.get(
        "/api/users/profile/me",
        headers=auth_headers(token),
    )

    assert response.status_code == 200, response.text

    body = response.json()

    assert body["id"] == user.id
    assert body["name"] == "Personal"
    assert body["lastname"] == "Account"
    assert body["email"] == user.email

    assert "company_name" not in body
    assert "company_sector_id" not in body
    assert "company_size_id" not in body
    assert "biannual_evaluation" not in body
    assert "next_evaluation" not in body

    assert "password" not in body

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

@pytest.mark.parametrize("company_count", [0, 1, 3])
def test_login_supports_multiple_company_memberships(
    client,
    db_session,
    company_count,
):
    unique_id = uuid4().hex

    user = User(
        name="Multiple",
        lastname="Companies",
        position="Developer",
        email=f"multi-company-{unique_id}@test.local",
        phone="9999999999",
        password=AuthService().hash_password(TEST_PASSWORD),
        role=UserRole.USER,
        active=True,
    )

    db_session.add(user)
    db_session.flush()

    for index in range(company_count):
        company = Company(
            name=f"Company {index} {unique_id}",
            active=True,
        )

        db_session.add(company)
        db_session.flush()

        db_session.add(
            CompanyMembership(
                user_id=user.id,
                company_id=company.id,
                role=CompanyRole.COMPANY_ADMIN,
                status=CompanyMembershipStatus.ACTIVE,
            )
        )

    db_session.flush()

    response = client.post(
        "/api/auth/login",
        json={
            "email": user.email,
            "password": TEST_PASSWORD,
        },
    )

    assert response.status_code == 200, response.text

    body = response.json()

    assert body["access_token"]
    assert body["user"]["id"] == user.id
    assert body["user"]["email"] == user.email
    assert "company_name" not in body["user"]
    assert "company_sector_id" not in body["user"]
    assert "company_size_id" not in body["user"]
    assert "biannual_evaluation" not in body["user"]
    assert "next_evaluation" not in body["user"]

    memberships_response = client.get(
        "/api/companies/me/memberships",
        headers=auth_headers(body["access_token"]),
    )

    assert memberships_response.status_code == 200
    assert len(memberships_response.json()) == company_count

    assert all(
        item["role"] == CompanyRole.COMPANY_ADMIN.value
        for item in memberships_response.json()
    )

def test_inactive_user_cannot_use_existing_access_token(
    client,
    db_session,
):
    unique_id = uuid4().hex

    user = User(
        name="Inactive",
        lastname="Token",
        position="Developer",
        email=f"inactive-token-{unique_id}@test.local",
        phone="9999999999",
        password=AuthService().hash_password(TEST_PASSWORD),
        role=UserRole.USER,
        active=True,
    )

    db_session.add(user)
    db_session.flush()

    token = login(client, user.email)

    # Confirmar que el token funciona antes de desactivar la cuenta.
    active_response = client.get(
        "/api/users/profile/me",
        headers=auth_headers(token),
    )

    assert active_response.status_code == 200

    # Desactivar la cuenta después de emitir el JWT.
    user.active = False
    db_session.flush()

    inactive_response = client.get(
        "/api/users/profile/me",
        headers=auth_headers(token),
    )

    assert inactive_response.status_code == 401
    assert inactive_response.json()["detail"] == (
        "The account is not active"
    )

def test_access_token_for_nonexistent_user_is_rejected(
    client,
    db_session,
):
    from sqlalchemy import func

    nonexistent_user_id = (
        db_session.query(func.coalesce(func.max(User.id), 0))
        .scalar()
        + 1000000
    )

    token = AuthService().create_token({
        "id": str(nonexistent_user_id),
        "role": UserRole.USER.value,
    })

    response = client.get(
        "/api/users/profile/me",
        headers=auth_headers(token),
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "User not found"

def test_inactive_user_cannot_refresh_existing_session(
    client,
    db_session,
):
    unique_id = uuid4().hex

    user = User(
        name="Refresh",
        lastname="Inactive",
        position="Developer",
        email=f"inactive-refresh-{unique_id}@test.local",
        phone="9999999999",
        password=AuthService().hash_password(TEST_PASSWORD),
        role=UserRole.USER,
        active=True,
    )

    db_session.add(user)
    db_session.flush()

    # Iniciar sesión mientras la cuenta está activa.
    login_response = client.post(
        "/api/auth/login",
        json={
            "email": user.email,
            "password": TEST_PASSWORD,
        },
    )

    assert login_response.status_code == 200
    assert client.cookies.get("refresh_token")

    # Desactivar la cuenta después de emitir el refresh token.
    user.active = False
    db_session.flush()

    # Intentar renovar la sesión con el token existente.
    response = client.post("/api/auth/refresh-token")

    assert response.status_code == 401
    assert response.json()["detail"] == (
        "The account is not active"
    )

    assert "access_token" not in response.json()
    assert "refresh_token" not in response.json()