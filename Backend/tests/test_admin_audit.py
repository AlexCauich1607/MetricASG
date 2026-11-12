
import pytest
from uuid import uuid4

from app.main import app
from app.core.roles import UserRole
from app.models.audit_log_model import AuditLog
from app.models.user_model import User
from app.services.token_service import get_current_user

from unittest.mock import patch

from app.services.admin_service import AdminService

@pytest.mark.parametrize(
    "initial_state, expected_state",
    [
        (True, False),
        (False, True),
    ],
)
def test_change_user_state_http_records_audit(
    client,
    db_session,
    initial_state,
    expected_state,
):
    unique_id = uuid4().hex

    admin = User(
        name="Audit Admin",
        email=f"admin-state-{unique_id}@test.local",
        company_name="Test Company",
        password="test-password",
        role=UserRole.ADMIN,
        active=True,
    )

    target_user = User(
        name="Target User",
        email=f"target-state-{unique_id}@test.local",
        company_name="Test Company",
        password="test-password",
        role=UserRole.USER,
        active=initial_state,
    )

    db_session.add_all([admin, target_user])
    db_session.flush()

    admin_id = admin.id
    target_user_id = target_user.id

    app.dependency_overrides[get_current_user] = lambda: admin

    response = client.post(
        f"/api/admin/change-user-state/{target_user_id}",
    )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "message": "User update success",
    }

    db_session.refresh(target_user)
    assert target_user.active is expected_state

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "user.state_changed",
            AuditLog.resource_type == "user",
            AuditLog.resource_id == target_user_id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == admin_id
    assert audit_event.company_id is None
    assert audit_event.context == {
        "previous_active": initial_state,
        "current_active": expected_state,
    }
    assert audit_event.created_at is not None


def test_change_user_state_http_rejects_non_admin(
    client,
    db_session,
):
    unique_id = uuid4().hex

    regular_user = User(
        name="Regular User",
        email=f"regular-state-{unique_id}@test.local",
        company_name="Test Company",
        password="test-password",
        role=UserRole.USER,
        active=True,
    )

    target_user = User(
        name="Protected User",
        email=f"protected-state-{unique_id}@test.local",
        company_name="Test Company",
        password="test-password",
        role=UserRole.USER,
        active=True,
    )

    db_session.add_all([regular_user, target_user])
    db_session.flush()

    target_user_id = target_user.id

    app.dependency_overrides[get_current_user] = lambda: regular_user

    response = client.post(
        f"/api/admin/change-user-state/{target_user_id}",
    )

    assert response.status_code == 403, response.text

    db_session.refresh(target_user)
    assert target_user.active is True

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "user.state_changed",
            AuditLog.resource_type == "user",
            AuditLog.resource_id == target_user_id,
        )
        .all()
    )

    assert audit_events == []


def test_change_user_state_rolls_back_on_audit_failure(db_session):
    unique_id = uuid4().hex

    admin = User(
        name="Audit Admin",
        email=f"admin-rollback-{unique_id}@test.local",
        company_name="Test Company",
        password="test-password",
        role=UserRole.ADMIN,
        active=True,
    )

    target_user = User(
        name="Rollback Target",
        email=f"target-rollback-{unique_id}@test.local",
        company_name="Test Company",
        password="test-password",
        role=UserRole.USER,
        active=True,
    )

    db_session.add_all([admin, target_user])
    db_session.commit()

    admin_id = admin.id
    target_user_id = target_user.id

    service = AdminService()

    with patch(
        "app.services.admin_service.AuditService.record",
        side_effect=RuntimeError("Audit recording failed"),
    ):
        with pytest.raises(
            RuntimeError,
            match="Audit recording failed",
        ):
            service.change_user_state(
                id=target_user_id,
                db=db_session,
                actor_id=admin_id,
            )

    db_session.expire_all()

    stored_user = db_session.get(User, target_user_id)

    assert stored_user is not None
    assert stored_user.active is True

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "user.state_changed",
            AuditLog.resource_type == "user",
            AuditLog.resource_id == target_user_id,
        )
        .all()
    )

    assert audit_events == []


def test_audit_logs_http_rejects_non_admin(client, db_session):
    from uuid import uuid4

    from app.main import app
    from app.models.user_model import User, UserRole
    from app.services.auth_service import AuthService
    from app.services.token_service import get_current_user

    unique_id = uuid4().hex

    user = User(
        name="Regular User",
        email=f"audit-reader-{unique_id}@test.local",
        company_name="Test Company",
        password=AuthService().hash_password("Password123!"),
        role=UserRole.USER,
        active=True,
    )

    db_session.add(user)
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: user

    response = client.get("/api/admin/audit-logs")

    assert response.status_code == 403


def test_audit_logs_http_admin_filters_and_paginates(
    client,
    db_session,
):
    from uuid import uuid4

    from app.main import app
    from app.models.audit_log_model import AuditLog
    from app.models.user_model import User, UserRole
    from app.services.auth_service import AuthService
    from app.services.token_service import get_current_user

    unique_id = uuid4().hex
    action = f"test.audit_{unique_id}"

    admin = User(
        name="Audit Admin",
        email=f"audit-admin-{unique_id}@test.local",
        company_name="Test Company",
        password=AuthService().hash_password("Password123!"),
        role=UserRole.ADMIN,
        active=True,
    )

    db_session.add(admin)
    db_session.flush()

    logs = [
        AuditLog(
            actor_id=admin.id,
            company_id=1,
            action=action,
            resource_type="evaluation",
            resource_id=101,
            context={"index": 1},
        ),
        AuditLog(
            actor_id=admin.id,
            company_id=1,
            action=action,
            resource_type="evaluation",
            resource_id=102,
            context={"index": 2},
        ),
        AuditLog(
            actor_id=admin.id,
            company_id=2,
            action=action,
            resource_type="evaluation",
            resource_id=103,
            context={"index": 3},
        ),
    ]

    db_session.add_all(logs)
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: admin

    response = client.get(
        "/api/admin/audit-logs",
        params={
            "actor_id": admin.id,
            "company_id": 1,
            "action": action,
            "resource_type": "evaluation",
            "limit": 1,
            "offset": 0,
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert data["total"] == 2
    assert data["limit"] == 1
    assert data["offset"] == 0
    assert len(data["items"]) == 1

    item = data["items"][0]

    assert item["actor_id"] == admin.id
    assert item["company_id"] == 1
    assert item["action"] == action
    assert item["resource_type"] == "evaluation"
    assert item["resource_id"] in [101, 102]
    assert item["context"] in [
        {"index": 1},
        {"index": 2},
    ]
    assert item["created_at"] is not None


@pytest.mark.parametrize(
    "params",
    [
        {"limit": 0},
        {"limit": 101},
        {"offset": -1},
        {"actor_id": 0},
        {"company_id": 0},
        {"resource_id": 0},
        {"action": ""},
        {"resource_type": ""},
        {"start_date": "2026-11-12T10:00:00"},
        {"end_date": "2026-11-12T10:00:00"},
        {
            "start_date": "2026-11-13T10:00:00Z",
            "end_date": "2026-11-12T10:00:00Z",
        },
    ],
)
def test_audit_logs_http_rejects_invalid_parameters(
    client,
    db_session,
    params,
):
    from uuid import uuid4

    from app.main import app
    from app.models.user_model import User, UserRole
    from app.services.auth_service import AuthService
    from app.services.token_service import get_current_user

    unique_id = uuid4().hex

    admin = User(
        name="Audit Validation Admin",
        email=f"audit-validation-{unique_id}@test.local",
        company_name="Test Company",
        password=AuthService().hash_password("Password123!"),
        role=UserRole.ADMIN,
        active=True,
    )

    db_session.add(admin)
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: admin

    response = client.get(
        "/api/admin/audit-logs",
        params=params,
    )

    assert response.status_code == 422, response.text


def test_audit_logs_http_rejects_company_admin(
    client,
    db_session,
):
    from uuid import uuid4

    from app.core.roles import CompanyRole
    from app.main import app
    from app.models.company_membership_model import (
        CompanyMembership,
        CompanyMembershipStatus,
    )
    from app.models.user_model import User, UserRole
    from app.services.auth_service import AuthService
    from app.services.token_service import get_current_user

    unique_id = uuid4().hex

    user = User(
        name="Company Admin",
        email=f"company-audit-{unique_id}@test.local",
        company_name="Test Company",
        password=AuthService().hash_password("Password123!"),
        role=UserRole.USER,
        active=True,
    )

    db_session.add(user)
    db_session.flush()

    # Se utiliza una empresa existente o una creada
    # específicamente para esta prueba.
    from app.models.company_model import Company

    company = Company(
        name=f"Audit Company {unique_id}",
    )

    db_session.add(company)
    db_session.flush()

    membership = CompanyMembership(
        user_id=user.id,
        company_id=company.id,
        role=CompanyRole.COMPANY_ADMIN,
        status=CompanyMembershipStatus.ACTIVE,
    )

    db_session.add(membership)
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: user

    response = client.get(
        "/api/admin/audit-logs",
        params={"company_id": company.id},
    )

    assert response.status_code == 403
