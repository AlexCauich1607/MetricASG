
from uuid import uuid4

from app.core.roles import UserRole
from app.models.ambit_model import Ambit
from app.models.audit_log_model import AuditLog
from app.models.methodology_model import Methodology, MethodologyStatus
from app.models.user_model import User
from app.services.methodology_catalog_service import (
    MethodologyCatalogService,
)
import pytest
from fastapi import HTTPException
from unittest.mock import patch
from app.main import app
from app.services.token_service import get_current_user

def test_create_methodology_catalog_records_audit(db_session):
    unique_id = uuid4().hex

    admin = User(
        name="Admin",
        email=f"catalog-admin-{unique_id}@test.local",
        company_name="Test Company",
        password="test-password",
        role=UserRole.ADMIN,
        active=True,
    )

    methodology = Methodology(
        name="Test Catalog Audit",
        version=f"TEST-CATALOG-{unique_id}",
        status=MethodologyStatus.DRAFT,
        is_active=False,
    )

    db_session.add_all([admin, methodology])
    db_session.flush()

    service = MethodologyCatalogService(Ambit, db_session)

    ambit = service.create(
        data={
            "name": "Environmental",
            "description": "Test ambit",
            "methodology_id": methodology.id,
        },
        actor_id=admin.id,
    )

    assert ambit.id is not None
    assert ambit.name == "Environmental"
    assert ambit.methodology_id == methodology.id

    stored_ambit = db_session.get(Ambit, ambit.id)

    assert stored_ambit is not None

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "methodology_catalog.created",
            AuditLog.resource_type == "ambits",
            AuditLog.resource_id == ambit.id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == admin.id
    assert audit_event.company_id is None
    assert audit_event.context == {
        "methodology_id": methodology.id,
    }
    assert audit_event.created_at is not None


def test_create_methodology_catalog_rejects_published(db_session):
    unique_id = uuid4().hex

    methodology = Methodology(
        name="Published Methodology",
        version=f"CAT-PUB-{unique_id}",
        status=MethodologyStatus.PUBLISHED,
        is_active=False,
    )

    db_session.add(methodology)
    db_session.flush()

    service = MethodologyCatalogService(Ambit, db_session)

    with pytest.raises(HTTPException) as exc:
        service.create(
            data={
                "name": "Environmental",
                "methodology_id": methodology.id,
            },
            actor_id=999999,
        )

    assert exc.value.status_code == 409
    assert exc.value.detail == (
        "Only catalogs from draft methodologies can be modified"
    )

    # No debe crearse el recurso.
    stored_ambits = (
        db_session.query(Ambit)
        .filter(Ambit.methodology_id == methodology.id)
        .all()
    )

    assert stored_ambits == []

    # No debe registrarse una creación rechazada como exitosa.
    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "methodology_catalog.created",
            AuditLog.resource_type == "ambits",
        )
        .all()
    )

    assert audit_events == []


def test_create_methodology_catalog_rolls_back_on_audit_failure(
    db_session,
):
    unique_id = uuid4().hex

    methodology = Methodology(
        name="Audit Rollback Test",
        version=f"CAT-RB-{unique_id}",
        status=MethodologyStatus.DRAFT,
        is_active=False,
    )

    db_session.add(methodology)
    db_session.commit()

    methodology_id = methodology.id
    service = MethodologyCatalogService(Ambit, db_session)

    with patch(
        "app.services.methodology_catalog_service.AuditService.record",
        side_effect=RuntimeError("Audit recording failed"),
    ):
        with pytest.raises(
            RuntimeError,
            match="Audit recording failed",
        ):
            service.create(
                data={
                    "name": "Rollback Test Ambit",
                    "methodology_id": methodology_id,
                },
                actor_id=999999,
            )

    # La creación debe revertirse tras el fallo de auditoría.
    stored_ambits = (
        db_session.query(Ambit)
        .filter(
            Ambit.methodology_id == methodology_id,
            Ambit.name == "Rollback Test Ambit",
        )
        .all()
    )

    assert stored_ambits == []

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "methodology_catalog.created",
            AuditLog.resource_type == "ambits",
        )
        .all()
    )

    assert audit_events == []

def test_update_methodology_catalog_records_audit(db_session):
    unique_id = uuid4().hex

    admin = User(
        name="Admin",
        email=f"catalog-update-{unique_id}@test.local",
        company_name="Test Company",
        password="test-password",
        role=UserRole.ADMIN,
        active=True,
    )

    methodology = Methodology(
        name="Catalog Update Audit",
        version=f"CAT-UPD-{unique_id}",
        status=MethodologyStatus.DRAFT,
        is_active=False,
    )

    db_session.add_all([admin, methodology])
    db_session.flush()

    ambit = Ambit(
        name="Original Ambit",
        description="Original description",
        methodology_id=methodology.id,
    )

    db_session.add(ambit)
    db_session.flush()

    ambit_id = ambit.id
    methodology_id = methodology.id
    admin_id = admin.id

    service = MethodologyCatalogService(Ambit, db_session)

    updated = service.update(
        item_id=ambit_id,
        data={
            "name": "Updated Ambit",
            "description": "Updated description",
        },
        actor_id=admin_id,
    )

    assert updated is not None
    assert updated.id == ambit_id
    assert updated.name == "Updated Ambit"
    assert updated.description == "Updated description"
    assert updated.methodology_id == methodology_id

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "methodology_catalog.updated",
            AuditLog.resource_type == "ambits",
            AuditLog.resource_id == ambit_id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == admin_id
    assert audit_event.company_id is None
    assert audit_event.context == {
        "methodology_id": methodology_id,
    }
    assert audit_event.created_at is not None

def test_update_methodology_catalog_rejects_published(db_session):
    unique_id = uuid4().hex

    methodology = Methodology(
        name="Published Catalog Update",
        version=f"CAT-UPD-PUB-{unique_id}",
        status=MethodologyStatus.PUBLISHED,
        is_active=False,
    )

    db_session.add(methodology)
    db_session.flush()

    ambit = Ambit(
        name="Original Ambit",
        methodology_id=methodology.id,
    )

    db_session.add(ambit)
    db_session.flush()

    ambit_id = ambit.id

    service = MethodologyCatalogService(Ambit, db_session)

    with pytest.raises(HTTPException) as exc:
        service.update(
            item_id=ambit_id,
            data={"name": "Unauthorized Update"},
            actor_id=999999,
        )

    assert exc.value.status_code == 409

    db_session.refresh(ambit)
    assert ambit.name == "Original Ambit"

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "methodology_catalog.updated",
            AuditLog.resource_type == "ambits",
            AuditLog.resource_id == ambit_id,
        )
        .all()
    )

    assert audit_events == []

def test_update_methodology_catalog_rolls_back_on_audit_failure(
    db_session,
):
    unique_id = uuid4().hex

    methodology = Methodology(
        name="Catalog Update Rollback",
        version=f"CAT-UPD-RB-{unique_id}",
        status=MethodologyStatus.DRAFT,
        is_active=False,
    )

    db_session.add(methodology)
    db_session.flush()

    ambit = Ambit(
        name="Original Ambit",
        description="Original description",
        methodology_id=methodology.id,
    )

    db_session.add(ambit)
    db_session.commit()

    ambit_id = ambit.id
    service = MethodologyCatalogService(Ambit, db_session)

    with patch(
        "app.services.methodology_catalog_service.AuditService.record",
        side_effect=RuntimeError("Audit recording failed"),
    ):
        with pytest.raises(
            RuntimeError,
            match="Audit recording failed",
        ):
            service.update(
                item_id=ambit_id,
                data={
                    "name": "Modified Ambit",
                    "description": "Modified description",
                },
                actor_id=999999,
            )

    # Los cambios no deben persistir.
    db_session.expire_all()
    stored_ambit = db_session.get(Ambit, ambit_id)

    assert stored_ambit is not None
    assert stored_ambit.name == "Original Ambit"
    assert stored_ambit.description == "Original description"

    # No debe existir un evento de actualización exitosa.
    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "methodology_catalog.updated",
            AuditLog.resource_type == "ambits",
            AuditLog.resource_id == ambit_id,
        )
        .all()
    )

    assert audit_events == []

def test_update_methodology_catalog_rejects_methodology_change(
    db_session,
):
    unique_id = uuid4().hex

    source_methodology = Methodology(
        name="Source Methodology",
        version=f"CAT-SRC-{unique_id}",
        status=MethodologyStatus.DRAFT,
        is_active=False,
    )

    target_methodology = Methodology(
        name="Target Methodology",
        version=f"CAT-DST-{unique_id}",
        status=MethodologyStatus.DRAFT,
        is_active=False,
    )

    db_session.add_all([source_methodology, target_methodology])
    db_session.flush()

    ambit = Ambit(
        name="Original Ambit",
        methodology_id=source_methodology.id,
    )

    db_session.add(ambit)
    db_session.flush()

    ambit_id = ambit.id
    source_methodology_id = source_methodology.id

    service = MethodologyCatalogService(Ambit, db_session)

    with pytest.raises(HTTPException) as exc:
        service.update(
            item_id=ambit_id,
            data={
                "methodology_id": target_methodology.id,
            },
            actor_id=999999,
        )

    assert exc.value.status_code == 409
    assert exc.value.detail == (
        "Catalog records cannot be moved between methodologies"
    )

    db_session.refresh(ambit)

    assert ambit.methodology_id == source_methodology_id

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "methodology_catalog.updated",
            AuditLog.resource_type == "ambits",
            AuditLog.resource_id == ambit_id,
        )
        .all()
    )

    assert audit_events == []


def test_delete_methodology_catalog_records_audit(db_session):
    unique_id = uuid4().hex

    admin = User(
        name="Admin",
        email=f"catalog-delete-{unique_id}@test.local",
        company_name="Test Company",
        password="test-password",
        role=UserRole.ADMIN,
        active=True,
    )

    methodology = Methodology(
        name="Catalog Delete Audit",
        version=f"CAT-DEL-{unique_id}",
        status=MethodologyStatus.DRAFT,
        is_active=False,
    )

    db_session.add_all([admin, methodology])
    db_session.flush()

    ambit = Ambit(
        name="Ambit To Delete",
        methodology_id=methodology.id,
    )

    db_session.add(ambit)
    db_session.flush()

    ambit_id = ambit.id
    methodology_id = methodology.id
    admin_id = admin.id

    service = MethodologyCatalogService(Ambit, db_session)

    deleted = service.delete(
        item_id=ambit_id,
        actor_id=admin_id,
    )

    assert deleted is True
    assert db_session.get(Ambit, ambit_id) is None

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "methodology_catalog.deleted",
            AuditLog.resource_type == "ambits",
            AuditLog.resource_id == ambit_id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == admin_id
    assert audit_event.company_id is None
    assert audit_event.context == {
        "methodology_id": methodology_id,
    }
    assert audit_event.created_at is not None


def test_delete_methodology_catalog_rejects_published(db_session):
    unique_id = uuid4().hex

    methodology = Methodology(
        name="Published Catalog Delete",
        version=f"CAT-DEL-PUB-{unique_id}",
        status=MethodologyStatus.PUBLISHED,
        is_active=False,
    )

    db_session.add(methodology)
    db_session.flush()

    ambit = Ambit(
        name="Protected Ambit",
        methodology_id=methodology.id,
    )

    db_session.add(ambit)
    db_session.flush()

    ambit_id = ambit.id

    service = MethodologyCatalogService(Ambit, db_session)

    with pytest.raises(HTTPException) as exc:
        service.delete(
            item_id=ambit_id,
            actor_id=999999,
        )

    assert exc.value.status_code == 409

    stored_ambit = db_session.get(Ambit, ambit_id)

    assert stored_ambit is not None
    assert stored_ambit.name == "Protected Ambit"

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "methodology_catalog.deleted",
            AuditLog.resource_type == "ambits",
            AuditLog.resource_id == ambit_id,
        )
        .all()
    )

    assert audit_events == []


def test_delete_methodology_catalog_rolls_back_on_audit_failure(
    db_session,
):
    unique_id = uuid4().hex

    methodology = Methodology(
        name="Catalog Delete Rollback",
        version=f"CAT-DEL-RB-{unique_id}",
        status=MethodologyStatus.DRAFT,
        is_active=False,
    )

    db_session.add(methodology)
    db_session.flush()

    ambit = Ambit(
        name="Ambit To Preserve",
        methodology_id=methodology.id,
    )

    db_session.add(ambit)
    db_session.commit()

    ambit_id = ambit.id
    methodology_id = methodology.id

    service = MethodologyCatalogService(Ambit, db_session)

    with patch(
        "app.services.methodology_catalog_service.AuditService.record",
        side_effect=RuntimeError("Audit recording failed"),
    ):
        with pytest.raises(
            RuntimeError,
            match="Audit recording failed",
        ):
            service.delete(
                item_id=ambit_id,
                actor_id=999999,
            )

    # La eliminación debe revertirse.
    db_session.expire_all()

    stored_ambit = db_session.get(Ambit, ambit_id)

    assert stored_ambit is not None
    assert stored_ambit.name == "Ambit To Preserve"
    assert stored_ambit.methodology_id == methodology_id

    # No debe registrarse una eliminación exitosa.
    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "methodology_catalog.deleted",
            AuditLog.resource_type == "ambits",
            AuditLog.resource_id == ambit_id,
        )
        .all()
    )

    assert audit_events == []


def test_create_methodology_catalog_http_records_audit(
    client,
    db_session,
):
    unique_id = uuid4().hex

    admin = User(
        name="Catalog HTTP Admin",
        email=f"catalog-http-{unique_id}@test.local",
        company_name="Test Company",
        password="test-password",
        role=UserRole.ADMIN,
        active=True,
    )

    methodology = Methodology(
        name="Catalog HTTP Audit",
        version=f"CAT-HTTP-{unique_id}",
        status=MethodologyStatus.DRAFT,
        is_active=False,
    )

    db_session.add_all([admin, methodology])
    db_session.flush()

    admin_id = admin.id
    methodology_id = methodology.id

    app.dependency_overrides[get_current_user] = lambda: admin

    response = client.post(
        "/api/ambits/",
        json={
            "name": "HTTP Audit Ambit",
            "description": "Created through HTTP",
            "methodology_id": methodology_id,
        },
    )

    assert response.status_code == 200, response.text

    body = response.json()

    assert body["id"] is not None
    assert body["name"] == "HTTP Audit Ambit"
    assert body["methodology_id"] == methodology_id

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "methodology_catalog.created",
            AuditLog.resource_type == "ambits",
            AuditLog.resource_id == body["id"],
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == admin_id
    assert audit_event.company_id is None
    assert audit_event.context == {
        "methodology_id": methodology_id,
    }


def test_update_methodology_catalog_http_records_audit(
    client,
    db_session,
):
    unique_id = uuid4().hex

    admin = User(
        name="Catalog HTTP Update Admin",
        email=f"catalog-http-upd-{unique_id}@test.local",
        company_name="Test Company",
        password="test-password",
        role=UserRole.ADMIN,
        active=True,
    )

    methodology = Methodology(
        name="Catalog HTTP Update",
        version=f"CAT-HTTP-UPD-{unique_id}",
        status=MethodologyStatus.DRAFT,
        is_active=False,
    )

    db_session.add_all([admin, methodology])
    db_session.flush()

    ambit = Ambit(
        name="Original HTTP Ambit",
        description="Original description",
        methodology_id=methodology.id,
    )

    db_session.add(ambit)
    db_session.flush()

    admin_id = admin.id
    ambit_id = ambit.id
    methodology_id = methodology.id

    app.dependency_overrides[get_current_user] = lambda: admin

    response = client.put(
        f"/api/ambits/{ambit_id}",
        json={
            "name": "Updated HTTP Ambit",
            "description": "Updated through HTTP",
        },
    )

    assert response.status_code == 200, response.text

    body = response.json()

    assert body["id"] == ambit_id
    assert body["name"] == "Updated HTTP Ambit"
    assert body["description"] == "Updated through HTTP"
    assert body["methodology_id"] == methodology_id

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "methodology_catalog.updated",
            AuditLog.resource_type == "ambits",
            AuditLog.resource_id == ambit_id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == admin_id
    assert audit_event.company_id is None
    assert audit_event.context == {
        "methodology_id": methodology_id,
    }


def test_delete_methodology_catalog_http_records_audit(
    client,
    db_session,
):
    unique_id = uuid4().hex

    admin = User(
        name="Catalog HTTP Delete Admin",
        email=f"catalog-http-del-{unique_id}@test.local",
        company_name="Test Company",
        password="test-password",
        role=UserRole.ADMIN,
        active=True,
    )

    methodology = Methodology(
        name="Catalog HTTP Delete",
        version=f"CAT-HTTP-DEL-{unique_id}",
        status=MethodologyStatus.DRAFT,
        is_active=False,
    )

    db_session.add_all([admin, methodology])
    db_session.flush()

    ambit = Ambit(
        name="HTTP Ambit To Delete",
        methodology_id=methodology.id,
    )

    db_session.add(ambit)
    db_session.flush()

    admin_id = admin.id
    ambit_id = ambit.id
    methodology_id = methodology.id

    app.dependency_overrides[get_current_user] = lambda: admin

    response = client.delete(
        f"/api/ambits/{ambit_id}",
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"success": True}

    assert db_session.get(Ambit, ambit_id) is None

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "methodology_catalog.deleted",
            AuditLog.resource_type == "ambits",
            AuditLog.resource_id == ambit_id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == admin_id
    assert audit_event.company_id is None
    assert audit_event.context == {
        "methodology_id": methodology_id,
    }


@pytest.mark.parametrize(
    "method",
    ["post", "put", "delete"],
)
def test_methodology_catalog_http_rejects_non_admin(
    client,
    db_session,
    method,
):
    unique_id = uuid4().hex

    user = User(
        name="Catalog Regular User",
        email=f"catalog-user-{unique_id}@test.local",
        company_name="Test Company",
        password="test-password",
        role=UserRole.USER,
        active=True,
    )

    methodology = Methodology(
        name="Catalog Authorization Test",
        version=f"CAT-AUTH-{unique_id}",
        status=MethodologyStatus.DRAFT,
        is_active=False,
    )

    db_session.add_all([user, methodology])
    db_session.flush()

    ambit = Ambit(
        name="Protected Ambit",
        description="Original description",
        methodology_id=methodology.id,
    )

    db_session.add(ambit)
    db_session.flush()

    ambit_id = ambit.id

    app.dependency_overrides[get_current_user] = lambda: user

    if method == "post":
        response = client.post(
            "/api/ambits/",
            json={
                "name": "Unauthorized Ambit",
                "methodology_id": methodology.id,
            },
        )

        action = "methodology_catalog.created"

    elif method == "put":
        response = client.put(
            f"/api/ambits/{ambit_id}",
            json={
                "name": "Unauthorized Update",
            },
        )

        action = "methodology_catalog.updated"

    else:
        response = client.delete(
            f"/api/ambits/{ambit_id}",
        )

        action = "methodology_catalog.deleted"

    assert response.status_code == 403, response.text

    # El ámbito existente debe permanecer sin cambios.
    db_session.expire_all()

    stored_ambit = db_session.get(Ambit, ambit_id)

    assert stored_ambit is not None
    assert stored_ambit.name == "Protected Ambit"
    assert stored_ambit.description == "Original description"

    # No debe aparecer un ámbito creado sin autorización.
    unauthorized_ambits = (
        db_session.query(Ambit)
        .filter(
            Ambit.methodology_id == methodology.id,
            Ambit.name == "Unauthorized Ambit",
        )
        .all()
    )

    assert unauthorized_ambits == []

    # Ninguna operación rechazada debe generar auditoría de éxito.
    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == action,
            AuditLog.resource_type == "ambits",
        )
        .all()
    )

    assert audit_events == []

@pytest.mark.parametrize("method", ["put", "delete"])
def test_methodology_catalog_http_returns_404_for_missing_resource(
    client,
    db_session,
    method,
):
    unique_id = uuid4().hex

    admin = User(
        name="Catalog HTTP Admin",
        email=f"catalog-404-{unique_id}@test.local",
        company_name="Test Company",
        password="test-password",
        role=UserRole.ADMIN,
        active=True,
    )

    db_session.add(admin)
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: admin

    # Identificador que no existe en la tabla de ámbitos.
    missing_id = (
        db_session.query(Ambit.id)
        .order_by(Ambit.id.desc())
        .first()
    )

    missing_id = missing_id[0] + 1 if missing_id else 1

    if method == "put":
        response = client.put(
            f"/api/ambits/{missing_id}",
            json={"name": "Nonexistent Ambit"},
        )
        action = "methodology_catalog.updated"

    else:
        response = client.delete(
            f"/api/ambits/{missing_id}",
        )
        action = "methodology_catalog.deleted"

    assert response.status_code == 404, response.text

    assert response.json()["detail"] == "Item not found"

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == action,
            AuditLog.resource_type == "ambits",
            AuditLog.resource_id == missing_id,
        )
        .all()
    )

    assert audit_events == []
