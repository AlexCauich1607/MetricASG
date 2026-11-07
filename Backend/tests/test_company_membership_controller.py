
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

@pytest.mark.parametrize(
    "method, endpoint",
    [
        (
            "GET",
            "/api/companies/10/members",
        ),
        (
            "DELETE",
            "/api/companies/10/members/20",
        ),
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
        assert "role" not in body[0]

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
