from jose import jwt
from fastapi import HTTPException
from app.core.config import settings
from app.models.refresh_session_model import RefreshSession
from app.models.user_model import User
from app.services.auth_service import AuthService
from app.core.roles import UserRole, CompanyRole
from app.models.company_model import Company
from app.models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)
from unittest.mock import patch
from app.models.audit_log_model import AuditLog
import pytest
from app.services.token_service import get_current_user

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

    # Verificar la auditoría del inicio de sesión exitoso.
    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "auth.login_succeeded",
            AuditLog.resource_type == "user",
            AuditLog.resource_id == user.id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == user.id
    assert audit_event.company_id is None
    assert audit_event.context == {}
    assert audit_event.created_at is not None



def test_login_user_not_found(client, db_session):
    response = client.post(
        "/api/auth/login",
        json={
            "email": "nonexistent@test.local",
            "password": TEST_PASSWORD,
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"

    # No debe existir un evento de inicio de sesión exitoso.
    successful_events = (
        db_session.query(AuditLog)
        .filter(AuditLog.action == "auth.login_succeeded")
        .all()
    )

    assert successful_events == []

    # Debe registrarse el intento de autenticación fallido.
    failed_events = (
        db_session.query(AuditLog)
        .filter(AuditLog.action == "auth.login_failed")
        .all()
    )

    assert len(failed_events) == 1

    audit_event = failed_events[0]

    assert audit_event.resource_type == "user"
    assert audit_event.resource_id is None
    assert audit_event.actor_id is None
    assert audit_event.company_id is None
    assert audit_event.context == {
        "reason": "user_not_found",
    }
    assert audit_event.created_at is not None

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

    audit_events = (
        db_session.query(AuditLog)
        .filter(AuditLog.action == "auth.login_succeeded")
        .all()
    )

    assert audit_events == []

    # Verificar la auditoría del intento fallido.
    failed_events = (
        db_session.query(AuditLog)
        .filter(AuditLog.action == "auth.login_failed")
        .all()
    )

    assert len(failed_events) == 1

    audit_event = failed_events[0]

    user = (
        db_session.query(User)
        .filter(User.email == TEST_EMAIL)
        .one()
    )

    assert audit_event.resource_type == "user"
    assert audit_event.resource_id == user.id
    assert audit_event.actor_id is None
    assert audit_event.company_id is None
    assert audit_event.context == {
        "reason": "invalid_credentials",
    }
    assert audit_event.created_at is not None


def test_login_inactive_account(client, db_session):
    user = create_test_user(db_session)
    user.active = False
    db_session.commit()

    response = client.post(
        "/api/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "The account is not active"

    successful_events = (
        db_session.query(AuditLog)
        .filter(AuditLog.action == "auth.login_succeeded")
        .all()
    )

    assert successful_events == []

    failed_events = (
        db_session.query(AuditLog)
        .filter(AuditLog.action == "auth.login_failed")
        .all()
    )

    assert len(failed_events) == 1

    audit_event = failed_events[0]

    assert audit_event.resource_type == "user"
    assert audit_event.resource_id == user.id
    assert audit_event.actor_id is None
    assert audit_event.company_id is None
    assert audit_event.context == {
        "reason": "inactive_account",
    }
    assert audit_event.created_at is not None

    # Un inicio rechazado no debe crear una sesión.
    assert (
        db_session.query(RefreshSession)
        .filter(RefreshSession.user_id == user.id)
        .count()
        == 0
    )

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

    # Verificar la auditoría del cierre de sesión.
    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "auth.logout_succeeded",
            AuditLog.resource_type == "user",
            AuditLog.resource_id == user.id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == user.id
    assert audit_event.company_id is None
    assert audit_event.context == {}
    assert audit_event.created_at is not None

    # Verificar que el inicio y cierre de sesión fueron auditados.
    login_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "auth.login_succeeded",
            AuditLog.resource_id == user.id,
        )
        .all()
    )

    assert len(login_events) == 1
    assert audit_event.created_at >= login_events[0].created_at


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

def test_register_creates_company_and_active_membership(client, db_session):
    email = "register-company-member@test.local"

    response = client.post(
        "/api/auth/register",
        json={
            "name": "Company",
            "lastname": "Member",
            "position": "Manager",
            "company_name": "Registration Test Company",
            "email": email,
            "phone": "9999999999",
            "password": TEST_PASSWORD,
        },
    )

    assert response.status_code == 200

    user = (
        db_session.query(User)
        .filter(User.email == email)
        .one()
    )

    company = (
        db_session.query(Company)
        .filter(Company.name == "Registration Test Company")
        .one()
    )

    membership = (
        db_session.query(CompanyMembership)
        .filter(
            CompanyMembership.user_id == user.id,
            CompanyMembership.company_id == company.id,
        )
        .one()
    )

    assert user.role == UserRole.USER.value
    assert company.active is True
    assert membership.status == CompanyMembershipStatus.ACTIVE
    assert membership.role == CompanyRole.COMPANY_ADMIN
    assert user.company_name == company.name

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "user.created",
            AuditLog.resource_type == "user",
            AuditLog.resource_id == user.id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == user.id
    assert audit_event.company_id == company.id
    assert audit_event.context == {
        "registration_type": "company_account",
    }
    assert audit_event.created_at is not None

def test_register_company_creates_active_membership(client, db_session):
    email = "register-organization@test.local"

    response = client.post(
        "/api/auth/register-company",
        json={
            "company_name": "Organization Registration Test",
            "email": email,
            "phone": "9999999998",
            "password": TEST_PASSWORD,
        },
    )

    assert response.status_code == 200

    user = (
        db_session.query(User)
        .filter(User.email == email)
        .one()
    )

    company = (
        db_session.query(Company)
        .filter(Company.name == "Organization Registration Test")
        .one()
    )

    membership = (
        db_session.query(CompanyMembership)
        .filter(
            CompanyMembership.user_id == user.id,
            CompanyMembership.company_id == company.id,
        )
        .one()
    )

    assert user.name is None
    assert user.lastname is None
    assert user.position is None
    assert user.role == UserRole.USER.value
    assert company.active is True
    assert membership.status == CompanyMembershipStatus.ACTIVE
    assert membership.role == CompanyRole.COMPANY_ADMIN
    assert user.company_name == company.name

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "user.created",
            AuditLog.resource_type == "user",
            AuditLog.resource_id == user.id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == user.id
    assert audit_event.company_id == company.id
    assert audit_event.context == {
        "registration_type": "company_account",
    }
    assert audit_event.created_at is not None

def test_register_company_rolls_back_on_commit_failure(db_session):
    email = "rollback-company@test.local"
    company_name = "Rollback Test Company"

    service = AuthService()

    payload = {
        "name": "Rollback",
        "lastname": "Test",
        "position": "Manager",
        "company_name": company_name,
        "email": email,
        "phone": "9999999999",
        "password": TEST_PASSWORD,
    }

    with patch.object(
        db_session,
        "commit",
        side_effect=RuntimeError("Simulated commit failure"),
    ), patch.object(
        db_session,
        "rollback",
        wraps=db_session.rollback,
    ) as mock_rollback:

        with pytest.raises(
            RuntimeError,
            match="Simulated commit failure",
        ):
            service.create_user(payload, db_session)

        mock_rollback.assert_called_once()

    assert (
        db_session.query(User)
        .filter(User.email == email)
        .count()
        == 0
    )

    assert (
        db_session.query(Company)
        .filter(Company.name == company_name)
        .count()
        == 0
    )

    assert (
        db_session.query(CompanyMembership)
        .join(
            User,
            CompanyMembership.user_id == User.id,
        )
        .filter(User.email == email)
        .count()
        == 0
    )


def test_change_password_success(client, db_session):
    user = create_test_user(db_session)
    auth_service = AuthService()

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        },
    )

    assert login_response.status_code == 200

    access_token = login_response.json()["access_token"]
    new_password = "NewPassword123!"

    response = client.post(
        "/api/auth/change-password",
        headers={
            "Authorization": f"Bearer {access_token}",
        },
        json={
            "bf_password": TEST_PASSWORD,
            "new_password": new_password,
        },
    )

    assert response.status_code == 200
    assert response.json() == {"success": True}

    db_session.refresh(user)

    assert auth_service.verify_password(
        new_password,
        user.password,
    )

    assert not auth_service.verify_password(
        TEST_PASSWORD,
        user.password,
    )

    # Verificar la auditoría del cambio de contraseña.
    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "user.password_changed",
            AuditLog.resource_type == "user",
            AuditLog.resource_id == user.id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == user.id
    assert audit_event.company_id is None
    assert audit_event.context == {}
    assert audit_event.created_at is not None


def test_change_password_incorrect_current_password(
    client,
    db_session,
):
    user = create_test_user(db_session)
    auth_service = AuthService()

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        },
    )

    assert login_response.status_code == 200
    access_token = login_response.json()["access_token"]

    response = client.post(
        "/api/auth/change-password",
        headers={
            "Authorization": f"Bearer {access_token}",
        },
        json={
            "bf_password": "WrongPassword123!",
            "new_password": "NewPassword123!",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect password"

    db_session.refresh(user)

    # La contraseña original debe continuar siendo válida.
    assert auth_service.verify_password(
        TEST_PASSWORD,
        user.password,
    )

    assert not auth_service.verify_password(
        "NewPassword123!",
        user.password,
    )

    # No debe registrarse un cambio de contraseña exitoso.
    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "user.password_changed",
            AuditLog.resource_type == "user",
            AuditLog.resource_id == user.id,
        )
        .all()
    )

    assert audit_events == []


def test_change_password_user_not_found(db_session):
    auth_service = AuthService()

    with pytest.raises(HTTPException) as exc:
        auth_service.chage_password(
            user_id=999999999,
            new_password="NewPassword123!",
            bf_password=TEST_PASSWORD,
            db=db_session,
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == "User not found"

    # No debe registrarse un cambio de contraseña exitoso.
    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "user.password_changed",
        )
        .all()
    )

    assert audit_events == []


def test_register_company_rolls_back_on_audit_failure(db_session):
    from uuid import uuid4

    unique_id = uuid4().hex
    email = f"registration-audit-rollback-{unique_id}@test.local"
    company_name = f"Audit Rollback Company {unique_id}"

    with patch(
        "app.services.auth_service.AuditService.record",
        side_effect=RuntimeError("Audit recording failed"),
    ):
        with pytest.raises(
            RuntimeError,
            match="Audit recording failed",
        ):
            AuthService().create_company(
                data={
                    "company_name": company_name,
                    "email": email,
                    "phone": "9999999998",
                    "password": TEST_PASSWORD,
                },
                db=db_session,
            )

    db_session.expire_all()

    assert (
        db_session.query(User)
        .filter(User.email == email)
        .first()
    ) is None

    assert (
        db_session.query(Company)
        .filter(Company.name == company_name)
        .first()
    ) is None

    assert (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "user.created",
            AuditLog.context["registration_type"].as_string()
            == "company_account",
        )
        .count()
    ) == 0

def test_create_admin_http_records_audit(client, db_session):
    from uuid import uuid4

    from app.main import app

    unique_id = uuid4().hex

    creator = User(
        name="Creator Admin",
        email=f"creator-admin-{unique_id}@test.local",
        company_name="Test Company",
        password=AuthService().hash_password(TEST_PASSWORD),
        role=UserRole.ADMIN,
        active=True,
    )

    db_session.add(creator)
    db_session.flush()

    creator_id = creator.id
    new_admin_email = f"created-admin-{unique_id}@test.local"

    app.dependency_overrides[get_current_user] = lambda: creator

    response = client.post(
        "/api/auth/create-admin",
        json={
            "name": "Created Admin",
            "lastname": "Audit",
            "email": new_admin_email,
            "password": TEST_PASSWORD,
        },
    )

    assert response.status_code == 200, response.text

    created_admin = (
        db_session.query(User)
        .filter(User.email == new_admin_email)
        .one()
    )

    assert created_admin.role == UserRole.ADMIN.value
    assert created_admin.company_name == "Created Admin"

    assert AuthService().verify_password(
        TEST_PASSWORD,
        created_admin.password,
    )

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "user.created",
            AuditLog.resource_type == "user",
            AuditLog.resource_id == created_admin.id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == creator_id
    assert audit_event.company_id is None
    assert audit_event.context == {
        "registration_type": "global_admin",
    }
    assert audit_event.created_at is not None


def test_create_admin_rolls_back_on_audit_failure(db_session):
    from uuid import uuid4

    unique_id = uuid4().hex

    creator = User(
        name="Creator Admin",
        email=f"creator-rollback-{unique_id}@test.local",
        company_name="Test Company",
        password=AuthService().hash_password(TEST_PASSWORD),
        role=UserRole.ADMIN,
        active=True,
    )

    db_session.add(creator)
    db_session.commit()

    creator_id = creator.id
    new_admin_email = f"admin-rollback-{unique_id}@test.local"

    with patch(
        "app.services.auth_service.AuditService.record",
        side_effect=RuntimeError("Audit recording failed"),
    ):
        with pytest.raises(
            RuntimeError,
            match="Audit recording failed",
        ):
            AuthService().create_admin(
                data={
                    "name": "Rollback Admin",
                    "lastname": "Audit",
                    "email": new_admin_email,
                    "password": TEST_PASSWORD,
                },
                db=db_session,
                actor_id=creator_id,
            )

    db_session.expire_all()

    created_admin = (
        db_session.query(User)
        .filter(User.email == new_admin_email)
        .first()
    )

    assert created_admin is None

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "user.created",
            AuditLog.actor_id == creator_id,
        )
        .all()
    )

    assert audit_events == []
