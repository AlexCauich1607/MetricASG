from app.core.roles import CompanyRole
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from app.main import app
from app.models.company_membership_model import CompanyMembershipStatus
from app.models.company_membership_response import CompanyMemberResponse
from app.models.user_model import User
from app.services.company_membership_service import CompanyMembershipService
from app.services.token_service import get_current_user
from app.database.database import get_db
from app.models.company_model import Company

@pytest.mark.parametrize(
    "method, endpoint",
    [
        ("POST", "/api/companies"),
        ("GET", "/api/companies/10"),
        ("PATCH", "/api/companies/10"),
        ("GET", "/api/companies/10/members"),
        ("DELETE", "/api/companies/10/members/20"),
    ],
)
def test_company_membership_endpoints_require_authentication(
    client,
    method,
    endpoint,
):
    response = client.request(
        method,
        endpoint,
    )

    assert response.status_code == 401

def test_list_company_members_http_success(client):
    authenticated_user = User(
        id=10001,
        email="member@example.com",
        active=True,
    )

    member = CompanyMemberResponse(
        membership_id=20001,
        user_id=authenticated_user.id,
        name="Ana",
        lastname="López",
        email=authenticated_user.email,
        position="Analista ASG",
        role=CompanyRole.ASG_MANAGER,
        status=CompanyMembershipStatus.ACTIVE,
        joined_at=datetime(
            2026, 11, 6, 15, 0, tzinfo=timezone.utc
        ),
    )

    def override_current_user():
        return authenticated_user

    app.dependency_overrides[get_current_user] = override_current_user

    try:
        with patch.object(
            CompanyMembershipService,
            "list_members",
            return_value=[member],
        ) as mock_list:

            response = client.get(
                "/api/companies/10/members"
            )

        assert response.status_code == 200, response.json()

        mock_list.assert_called_once()

        assert mock_list.call_args.kwargs["company_id"] == 10
        assert (
            mock_list.call_args.kwargs["current_user_id"]
            == authenticated_user.id
        )

        body = response.json()

        assert len(body) == 1

        assert body[0]["membership_id"] == 20001
        assert body[0]["user_id"] == authenticated_user.id
        assert body[0]["email"] == authenticated_user.email
        assert body[0]["status"] == "ACTIVE"
        assert body[0]["name"] == "Ana"

        assert "password" not in body[0]
        assert "phone" not in body[0]
        assert body[0]["role"] == "ASG_MANAGER"

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )


def test_remove_company_member_http_success(client):
    authenticated_user = User(
        id=10002,
        email="member@example.com",
        active=True,
    )

    mock_db = MagicMock()

    def override_current_user():
        return authenticated_user

    def override_get_db():
        yield mock_db

    app.dependency_overrides[get_current_user] = override_current_user
    app.dependency_overrides[get_db] = override_get_db

    try:
        with patch.object(
            CompanyMembershipService,
            "remove_member",
        ) as mock_remove:

            response = client.delete(
                "/api/companies/10/members/20"
            )

        assert response.status_code == 204
        assert response.content == b""

        mock_remove.assert_called_once_with(
            db=mock_db,
            company_id=10,
            membership_id=20,
            current_user_id=authenticated_user.id,
        )

        mock_db.commit.assert_called_once()
        mock_db.rollback.assert_not_called()

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )
        app.dependency_overrides.pop(
            get_db,
            None,
        )


@pytest.mark.parametrize(
    "error_status, error_detail",
    [
        (403, "Cannot remove another company member"),
        (404, "Company membership not found"),
        (409, "Cannot remove the last active company member"),
    ],
)
def test_remove_company_member_http_rolls_back_on_error(
    client,
    error_status,
    error_detail,
):
    authenticated_user = User(
        id=10003,
        email="member@example.com",
        active=True,
    )

    mock_db = MagicMock()

    def override_current_user():
        return authenticated_user

    def override_get_db():
        yield mock_db

    app.dependency_overrides[get_current_user] = override_current_user
    app.dependency_overrides[get_db] = override_get_db

    try:
        with patch.object(
            CompanyMembershipService,
            "remove_member",
            side_effect=HTTPException(
                status_code=error_status,
                detail=error_detail,
            ),
        ) as mock_remove:

            response = client.delete(
                "/api/companies/10/members/20"
            )

        assert response.status_code == error_status
        assert response.json() == {
            "detail": error_detail,
        }

        mock_remove.assert_called_once_with(
            db=mock_db,
            company_id=10,
            membership_id=20,
            current_user_id=authenticated_user.id,
        )

        mock_db.rollback.assert_called_once()
        mock_db.commit.assert_not_called()

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )
        app.dependency_overrides.pop(
            get_db,
            None,
        )

@pytest.mark.parametrize(
    "error_status, error_detail",
    [
        (403, "Active company membership required"),
        (404, "Company not found"),
    ],
)
def test_list_company_members_http_preserves_service_errors(
    client,
    error_status,
    error_detail,
):
    authenticated_user = User(
        id=10004,
        email="member@example.com",
        active=True,
    )

    def override_current_user():
        return authenticated_user

    app.dependency_overrides[get_current_user] = override_current_user

    try:
        with patch.object(
            CompanyMembershipService,
            "list_members",
            side_effect=HTTPException(
                status_code=error_status,
                detail=error_detail,
            ),
        ) as mock_list:

            response = client.get(
                "/api/companies/10/members"
            )

        assert response.status_code == error_status
        assert response.json() == {
            "detail": error_detail,
        }

        mock_list.assert_called_once()

        assert mock_list.call_args.kwargs["company_id"] == 10
        assert (
            mock_list.call_args.kwargs["current_user_id"]
            == authenticated_user.id
        )

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )

@pytest.mark.parametrize(
    "payload",
    [
        {"name": ""},
        {"name": "A" * 151},
        {"name": "Empresa", "sector_id": 0},
        {"name": "Empresa", "size_id": -1},
        {"sector_id": 1},
    ],
)
def test_create_company_rejects_invalid_payload(
    client,
    payload,
):
    authenticated_user = User(
        id=10010,
        email="validation-user@example.com",
        active=True,
    )

    app.dependency_overrides[get_current_user] = (
        lambda: authenticated_user
    )

    try:
        with patch.object(
            CompanyMembershipService,
            "create_company",
        ) as mock_create:

            response = client.post(
                "/api/companies",
                json=payload,
            )

        assert response.status_code == 422
        mock_create.assert_not_called()

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )


def test_get_company_http_success(client):
    authenticated_user = User(
        id=10003,
        email="company-member@example.com",
        active=True,
    )

    company = Company(
        id=10,
        name="Empresa de Prueba",
        sector_id=2,
        size_id=3,
        active=True,
        biannual_evaluation=False,
        next_evaluation=None,
    )

    def override_current_user():
        return authenticated_user

    app.dependency_overrides[get_current_user] = override_current_user

    try:
        with patch.object(
            CompanyMembershipService,
            "get_company",
            return_value=company,
        ) as mock_get:

            response = client.get("/api/companies/10")

        assert response.status_code == 200, response.json()

        mock_get.assert_called_once()

        assert mock_get.call_args.kwargs["company_id"] == 10
        assert (
            mock_get.call_args.kwargs["current_user_id"]
            == authenticated_user.id
        )

        body = response.json()

        assert body == {
            "id": 10,
            "name": "Empresa de Prueba",
            "sector_id": 2,
            "size_id": 3,
            "active": True,
            "biannual_evaluation": False,
            "next_evaluation": None,
        }

        assert "password" not in body
        assert "memberships" not in body

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )


def test_update_company_http_success(client):
    authenticated_user = User(
        id=10004,
        email="company-admin@example.com",
        active=True,
    )

    updated_company = Company(
        id=10,
        name="Empresa Actualizada",
        sector_id=2,
        size_id=3,
        active=True,
        biannual_evaluation=False,
        next_evaluation=None,
    )

    def override_current_user():
        return authenticated_user

    app.dependency_overrides[get_current_user] = override_current_user

    try:
        with patch.object(
            CompanyMembershipService,
            "update_company",
            return_value=updated_company,
        ) as mock_update:

            response = client.patch(
                "/api/companies/10",
                json={
                    "name": "Empresa Actualizada",
                },
            )

        assert response.status_code == 200, response.json()

        mock_update.assert_called_once()

        arguments = mock_update.call_args.kwargs

        assert arguments["company_id"] == 10
        assert arguments["current_user_id"] == authenticated_user.id

        payload = arguments["payload"]

        assert payload.name == "Empresa Actualizada"
        assert payload.model_dump(exclude_unset=True) == {
            "name": "Empresa Actualizada",
        }

        assert response.json() == {
            "id": 10,
            "name": "Empresa Actualizada",
            "sector_id": 2,
            "size_id": 3,
            "active": True,
            "biannual_evaluation": False,
            "next_evaluation": None,
        }

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )


@pytest.mark.parametrize(
    "method, service_method, status_code",
    [
        ("GET", "get_company", 403),
        ("GET", "get_company", 404),
        ("PATCH", "update_company", 403),
        ("PATCH", "update_company", 404),
        ("PATCH", "update_company", 422),
    ],
)
def test_company_detail_endpoints_propagate_http_errors(
    client,
    method,
    service_method,
    status_code,
):
    authenticated_user = User(
        id=10005,
        email="company-user@example.com",
        active=True,
    )

    def override_current_user():
        return authenticated_user

    app.dependency_overrides[get_current_user] = override_current_user

    try:
        with patch.object(
            CompanyMembershipService,
            service_method,
            side_effect=HTTPException(
                status_code=status_code,
                detail="Company operation rejected",
            ),
        ) as mock_service:

            request_kwargs = {}

            if method == "PATCH":
                request_kwargs["json"] = {
                    "name": "Empresa Actualizada",
                }

            response = client.request(
                method,
                "/api/companies/10",
                **request_kwargs,
            )

        assert response.status_code == status_code
        assert response.json() == {
            "detail": "Company operation rejected",
        }

        mock_service.assert_called_once()

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )
