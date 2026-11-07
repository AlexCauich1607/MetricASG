import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

from app.main import app
from app.models.company_invitation_model import (
    CompanyInvitation,
    CompanyInvitationStatus,
)
from app.models.user_model import User
from app.services.token_service import get_current_user
from types import SimpleNamespace

from app.models.company_membership_model import (
    CompanyMembershipStatus,
)
from app.services.company_invitation_service import (
    CompanyInvitationService,
)
from fastapi import HTTPException

@pytest.mark.parametrize(
    "endpoint, payload",
    [
        (
            "/api/company-invitations",
            {
                "company_id": 1,
                "email": "recipient@test.local",
            },
        ),
        (
            "/api/company-invitations/accept",
            {
                "token": "test-invitation-token",
            },
        ),
        (
            "/api/company-invitations/1/resend",
            None,
        ),
    ],
)
def test_company_invitation_endpoints_require_authentication(
    client,
    endpoint,
    payload,
):
    response = client.post(
        endpoint,
        json=payload,
    )

    assert response.status_code == 401


def test_create_company_invitation_http_success(client):
    unique_id = uuid4().hex
    now = datetime.now(timezone.utc)

    authenticated_user = User(
        id=10001,
        email=f"inviter-{unique_id}@example.com",
        active=True,
    )

    invitation = CompanyInvitation(
        id=20001,
        company_id=10,
        invited_by_user_id=authenticated_user.id,
        email=f"recipient-{unique_id}@example.com",
        token_hash="a" * 64,
        status=CompanyInvitationStatus.PENDING,
        created_at=now,
        expires_at=now + timedelta(days=7),
        accepted_at=None,
        last_resent_at=None,
    )

    def override_current_user():
        return authenticated_user

    app.dependency_overrides[get_current_user] = override_current_user

    try:
        with patch(
            "app.services.company_invitation_service."
            "CompanyInvitationService.create_and_send_invitation",
            return_value=invitation,
        ) as mock_create:

            response = client.post(
                "/api/company-invitations",
                json={
                    "company_id": 10,
                    "email": invitation.email,
                },
            )

        assert response.status_code == 201, response.json()

        mock_create.assert_called_once()

        assert mock_create.call_args.kwargs["company_id"] == 10
        assert (
            mock_create.call_args.kwargs["invited_by_user_id"]
            == authenticated_user.id
        )
        assert (
            mock_create.call_args.kwargs["email"]
            == invitation.email
        )

        body = response.json()

        assert body["id"] == invitation.id
        assert body["company_id"] == 10
        assert body["status"] == "PENDING"

        assert "token" not in body
        assert "token_hash" not in body

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )


def test_accept_company_invitation_http_success(client):
    authenticated_user = User(
        id=10002,
        email="recipient@example.com",
        active=True,
    )

    membership = SimpleNamespace(
        id=30001,
        company_id=10,
        user_id=authenticated_user.id,
        status=CompanyMembershipStatus.ACTIVE,
    )

    def override_current_user():
        return authenticated_user

    app.dependency_overrides[get_current_user] = override_current_user

    try:
        with patch.object(
            CompanyInvitationService,
            "accept_invitation",
            return_value=membership,
        ) as mock_accept:

            response = client.post(
                "/api/company-invitations/accept",
                json={
                    "token": "secure-invitation-token",
                },
            )

        assert response.status_code == 200, response.json()

        mock_accept.assert_called_once()

        assert mock_accept.call_args.kwargs["token"] == (
            "secure-invitation-token"
        )

        assert mock_accept.call_args.kwargs["current_user_id"] == (
            authenticated_user.id
        )

        body = response.json()

        assert body == {
            "membership_id": 30001,
            "company_id": 10,
            "user_id": authenticated_user.id,
            "status": "ACTIVE",
        }

        assert "token" not in body
        assert "token_hash" not in body

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )


def test_resend_company_invitation_http_success(client):
    unique_id = uuid4().hex
    now = datetime.now(timezone.utc)

    authenticated_user = User(
        id=10003,
        email=f"inviter-{unique_id}@example.com",
        active=True,
    )

    invitation = CompanyInvitation(
        id=20003,
        company_id=10,
        invited_by_user_id=authenticated_user.id,
        email=f"recipient-{unique_id}@example.com",
        token_hash="b" * 64,
        status=CompanyInvitationStatus.PENDING,
        created_at=now,
        expires_at=now + timedelta(days=7),
        accepted_at=None,
        last_resent_at=now,
    )

    def override_current_user():
        return authenticated_user

    app.dependency_overrides[get_current_user] = override_current_user

    try:
        with patch.object(
            CompanyInvitationService,
            "resend_invitation",
            return_value=invitation,
        ) as mock_resend:

            response = client.post(
                f"/api/company-invitations/{invitation.id}/resend"
            )

        assert response.status_code == 200, response.json()

        mock_resend.assert_called_once()

        assert mock_resend.call_args.kwargs["invitation_id"] == (
            invitation.id
        )

        assert mock_resend.call_args.kwargs["requested_by_user_id"] == (
            authenticated_user.id
        )

        body = response.json()

        assert body["id"] == invitation.id
        assert body["company_id"] == invitation.company_id
        assert body["email"] == invitation.email
        assert body["status"] == "PENDING"
        assert body["last_resent_at"] is not None

        assert "token" not in body
        assert "token_hash" not in body

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )


@pytest.mark.parametrize(
    "endpoint, payload",
    [
        (
            "/api/company-invitations",
            {
                "company_id": 0,
                "email": "recipient@example.com",
            },
        ),
        (
            "/api/company-invitations",
            {
                "company_id": 10,
                "email": "invalid-email",
            },
        ),
        (
            "/api/company-invitations/accept",
            {
                "token": "",
            },
        ),
        (
            "/api/company-invitations/accept",
            {},
        ),
    ],
)
def test_company_invitation_http_rejects_invalid_payloads(
    client,
    endpoint,
    payload,
):
    authenticated_user = User(
        id=10004,
        email="authenticated@example.com",
        active=True,
    )

    app.dependency_overrides[get_current_user] = (
        lambda: authenticated_user
    )

    try:
        with patch.object(
            CompanyInvitationService,
            "create_and_send_invitation",
        ) as mock_create, patch.object(
            CompanyInvitationService,
            "accept_invitation",
        ) as mock_accept:

            response = client.post(
                endpoint,
                json=payload,
            )

            assert response.status_code == 422, response.json()

            mock_create.assert_not_called()
            mock_accept.assert_not_called()

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )


@pytest.mark.parametrize(
    "endpoint, payload, service_method, error_status",
    [
        (
            "/api/company-invitations",
            {
                "company_id": 10,
                "email": "recipient@example.com",
            },
            "create_and_send_invitation",
            403,
        ),
        (
            "/api/company-invitations/accept",
            {
                "token": "invalid-invitation-token",
            },
            "accept_invitation",
            404,
        ),
        (
            "/api/company-invitations/10/resend",
            None,
            "resend_invitation",
            429,
        ),
    ],
)
def test_company_invitation_http_preserves_service_errors(
    client,
    endpoint,
    payload,
    service_method,
    error_status,
):
    authenticated_user = User(
        id=10005,
        email="authenticated@example.com",
        active=True,
    )

    app.dependency_overrides[get_current_user] = (
        lambda: authenticated_user
    )

    try:
        with patch.object(
            CompanyInvitationService,
            service_method,
            side_effect=HTTPException(
                status_code=error_status,
                detail="Test service error",
            ),
        ) as mock_service:

            response = client.post(
                endpoint,
                json=payload,
            )

        assert response.status_code == error_status
        assert response.json() == {
            "detail": "Test service error"
        }

        mock_service.assert_called_once()

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )


def test_resend_company_invitation_http_includes_retry_after(client):
    authenticated_user = User(
        id=10006,
        email="authenticated@example.com",
        active=True,
    )

    app.dependency_overrides[get_current_user] = (
        lambda: authenticated_user
    )

    try:
        with patch.object(
            CompanyInvitationService,
            "resend_invitation",
            side_effect=HTTPException(
                status_code=429,
                detail="Invitation resend cooldown is active",
                headers={"Retry-After": "300"},
            ),
        ) as mock_resend:

            response = client.post(
                "/api/company-invitations/10/resend"
            )

        assert response.status_code == 429
        assert response.json() == {
            "detail": "Invitation resend cooldown is active"
        }

        assert response.headers["retry-after"] == "300"

        mock_resend.assert_called_once()

        assert mock_resend.call_args.kwargs["invitation_id"] == 10
        assert (
            mock_resend.call_args.kwargs["requested_by_user_id"]
            == authenticated_user.id
        )

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )
