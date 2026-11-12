
from uuid import uuid4

from app.core.roles import UserRole
from app.main import app
from app.models.audit_log_model import AuditLog
from app.models.user_model import User
from app.services.auth_service import AuthService
from app.services.token_service import get_current_user
import pytest
from unittest.mock import patch

from app.services.user_service import UserService

def test_create_user_http_records_audit(client, db_session):
    unique_id = uuid4().hex

    admin = User(
        name="Audit Admin",
        email=f"user-audit-admin-{unique_id}@test.local",
        company_name="Test Company",
        password=AuthService().hash_password("Password123!"),
        role=UserRole.ADMIN,
        active=True,
    )

    db_session.add(admin)
    db_session.flush()

    admin_id = admin.id

    app.dependency_overrides[get_current_user] = lambda: admin

    response = client.post(
        "/api/users/",
        json={
            "name": "Created User",
            "lastname": "Audit",
            "company_name": "Test Company",
            "email": f"created-user-{unique_id}@test.local",
            "password": "Password123!",
            "role": UserRole.USER.value,
            "active": True,
        },
    )

    assert response.status_code == 200, response.text

    body = response.json()
    created_user_id = body["id"]

    created_user = db_session.get(User, created_user_id)
    assert AuthService().verify_password(
        "Password123!",
        created_user.password,
    )
    assert created_user.password != "Password123!"
    assert created_user is not None
    assert created_user.name == "Created User"
    assert created_user.role == UserRole.USER.value

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "user.created",
            AuditLog.resource_type == "user",
            AuditLog.resource_id == created_user_id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == admin_id
    assert audit_event.company_id is None
    assert audit_event.context == {}
    assert audit_event.created_at is not None


def test_create_user_rolls_back_on_audit_failure(db_session):
    unique_id = uuid4().hex
    email = f"user-rollback-{unique_id}@test.local"

    admin = User(
        name="Audit Admin",
        email=f"admin-rollback-{unique_id}@test.local",
        company_name="Test Company",
        password=AuthService().hash_password("Password123!"),
        role=UserRole.ADMIN,
        active=True,
    )

    db_session.add(admin)
    db_session.commit()

    admin_id = admin.id

    service = UserService(User, db_session)

    with patch(
        "app.services.user_service.AuditService.record",
        side_effect=RuntimeError("Audit recording failed"),
    ):
        with pytest.raises(
            RuntimeError,
            match="Audit recording failed",
        ):
            service.create(
                data={
                    "name": "Rollback User",
                    "company_name": "Test Company",
                    "email": email,
                    "password": "Password123!",
                    "role": UserRole.USER.value,
                    "active": True,
                },
                actor_id=admin_id,
            )

    # El usuario no debe existir después del rollback.
    stored_user = (
        db_session.query(User)
        .filter(User.email == email)
        .first()
    )

    assert stored_user is None

    # No debe registrarse una creación exitosa.
    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "user.created",
            AuditLog.resource_type == "user",
            AuditLog.actor_id == admin_id,
        )
        .all()
    )

    assert audit_events == []


def test_update_profile_http_records_audit(client, db_session):
    unique_id = uuid4().hex

    user = User(
        name="Original Name",
        lastname="Original Lastname",
        email=f"profile-audit-{unique_id}@test.local",
        company_name="Test Company",
        password=AuthService().hash_password("Password123!"),
        role=UserRole.USER,
        active=True,
    )

    db_session.add(user)
    db_session.flush()

    user_id = user.id
    original_password = user.password

    app.dependency_overrides[get_current_user] = lambda: user

    response = client.put(
        "/api/users/profile/me",
        json={
            "name": "Updated Name",
            "lastname": "Updated Lastname",
            "role": UserRole.ADMIN.value,
            "active": False,
            "password": "manipulated-password",
            "id": user_id + 1000,
        },
    )

    assert response.status_code == 200, response.text

    body = response.json()

    assert body["id"] == user_id
    assert body["name"] == "Updated Name"
    assert body["lastname"] == "Updated Lastname"
    assert "password" not in body

    db_session.refresh(user)

    assert user.name == "Updated Name"
    assert user.lastname == "Updated Lastname"

    # Los campos protegidos no deben modificarse.
    assert user.role == UserRole.USER.value
    assert user.active is True
    assert user.password == original_password

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "user.profile_updated",
            AuditLog.resource_type == "user",
            AuditLog.resource_id == user_id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == user_id
    assert audit_event.context == {}
    assert audit_event.created_at is not None


def test_update_profile_rolls_back_on_audit_failure(db_session):
    unique_id = uuid4().hex

    user = User(
        name="Original Name",
        lastname="Original Lastname",
        email=f"profile-rollback-{unique_id}@test.local",
        company_name="Test Company",
        password=AuthService().hash_password("Password123!"),
        role=UserRole.USER,
        active=True,
    )

    db_session.add(user)
    db_session.commit()

    user_id = user.id

    service = UserService(User, db_session)

    with patch(
        "app.services.user_service.AuditService.record",
        side_effect=RuntimeError("Audit recording failed"),
    ):
        with pytest.raises(
            RuntimeError,
            match="Audit recording failed",
        ):
            service.update_profile(
                user_id=user_id,
                data={
                    "name": "Modified Name",
                    "lastname": "Modified Lastname",
                },
            )

    db_session.expire_all()

    stored_user = db_session.get(User, user_id)

    assert stored_user is not None
    assert stored_user.name == "Original Name"
    assert stored_user.lastname == "Original Lastname"

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "user.profile_updated",
            AuditLog.resource_type == "user",
            AuditLog.resource_id == user_id,
        )
        .all()
    )

    assert audit_events == []


def test_update_user_http_records_audit(client, db_session):
    unique_id = uuid4().hex

    admin = User(
        name="Audit Admin",
        email=f"admin-update-{unique_id}@test.local",
        company_name="Test Company",
        password=AuthService().hash_password("Password123!"),
        role=UserRole.ADMIN,
        active=True,
    )

    target_user = User(
        name="Original Name",
        lastname="Original Lastname",
        email=f"target-update-{unique_id}@test.local",
        company_name="Test Company",
        password=AuthService().hash_password("Password123!"),
        role=UserRole.USER,
        active=True,
    )

    db_session.add_all([admin, target_user])
    db_session.flush()

    admin_id = admin.id
    target_user_id = target_user.id
    original_password = target_user.password

    app.dependency_overrides[get_current_user] = lambda: admin

    response = client.put(
        f"/api/users/{target_user_id}",
        json={
            "name": "Updated Name",
            "lastname": "Updated Lastname",
            "role": UserRole.ADMIN.value,
            "active": False,
            "password": "manipulated-password",
            "id": target_user_id + 1000,
            "unknown_field": "ignored",
        },
    )

    assert response.status_code == 200, response.text

    db_session.refresh(target_user)

    assert target_user.name == "Updated Name"
    assert target_user.lastname == "Updated Lastname"

    # Los campos protegidos no deben cambiar.
    assert target_user.id == target_user_id
    assert target_user.role == UserRole.USER.value
    assert target_user.active is True
    assert target_user.password == original_password

    assert not hasattr(target_user, "unknown_field")

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "user.updated",
            AuditLog.resource_type == "user",
            AuditLog.resource_id == target_user_id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == admin_id
    assert audit_event.context == {}
    assert audit_event.created_at is not None


def test_update_user_rolls_back_on_audit_failure(db_session):
    unique_id = uuid4().hex

    admin = User(
        name="Audit Admin",
        email=f"admin-update-rollback-{unique_id}@test.local",
        company_name="Test Company",
        password=AuthService().hash_password("Password123!"),
        role=UserRole.ADMIN,
        active=True,
    )

    target_user = User(
        name="Original Name",
        lastname="Original Lastname",
        email=f"target-update-rollback-{unique_id}@test.local",
        company_name="Test Company",
        password=AuthService().hash_password("Password123!"),
        role=UserRole.USER,
        active=True,
    )

    db_session.add_all([admin, target_user])
    db_session.commit()

    admin_id = admin.id
    target_user_id = target_user.id

    service = UserService(User, db_session)

    with patch(
        "app.services.user_service.AuditService.record",
        side_effect=RuntimeError("Audit recording failed"),
    ):
        with pytest.raises(
            RuntimeError,
            match="Audit recording failed",
        ):
            service.update(
                item_id=target_user_id,
                data={
                    "name": "Modified Name",
                    "lastname": "Modified Lastname",
                },
                actor_id=admin_id,
            )

    db_session.expire_all()

    stored_user = db_session.get(User, target_user_id)

    assert stored_user is not None
    assert stored_user.name == "Original Name"
    assert stored_user.lastname == "Original Lastname"

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "user.updated",
            AuditLog.resource_type == "user",
            AuditLog.resource_id == target_user_id,
        )
        .all()
    )

    assert audit_events == []


def test_update_user_http_rejects_non_admin(
    client,
    db_session,
):
    unique_id = uuid4().hex

    regular_user = User(
        name="Regular User",
        email=f"regular-update-{unique_id}@test.local",
        company_name="Test Company",
        password=AuthService().hash_password("Password123!"),
        role=UserRole.USER,
        active=True,
    )

    target_user = User(
        name="Original Name",
        email=f"protected-update-{unique_id}@test.local",
        company_name="Test Company",
        password=AuthService().hash_password("Password123!"),
        role=UserRole.USER,
        active=True,
    )

    db_session.add_all([regular_user, target_user])
    db_session.flush()

    target_user_id = target_user.id

    app.dependency_overrides[get_current_user] = lambda: regular_user

    response = client.put(
        f"/api/users/{target_user_id}",
        json={
            "name": "Unauthorized Change",
        },
    )

    assert response.status_code == 403, response.text

    db_session.refresh(target_user)

    assert target_user.name == "Original Name"

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "user.updated",
            AuditLog.resource_type == "user",
            AuditLog.resource_id == target_user_id,
        )
        .all()
    )

    assert audit_events == []
