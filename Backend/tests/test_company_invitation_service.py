
from datetime import datetime, timedelta, timezone
import uuid
from app.core.roles import UserRole, CompanyRole
from app.models.company_model import Company
from app.models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)
from app.models.company_invitation_model import (
    CompanyInvitation,
    CompanyInvitationStatus,
)
from app.models.user_model import User
from app.services.company_invitation_service import (
    CompanyInvitationService,
)
import pytest
from fastapi import HTTPException
from unittest.mock import patch

from sqlalchemy.exc import IntegrityError

from app.services.company_invitation_email_service import (
    CompanyInvitationEmailService,
)

from app.models.audit_log_model import AuditLog

def create_invitation_data(db_session):
    unique_id = uuid.uuid4().hex

    company = Company(
        name=f"Invitation Test Company {unique_id}",
        active=True,
    )

    inviter = User(
        name="Inviter",
        lastname="Test",
        position="Manager",
        company_name=company.name,
        email=f"inviter-{unique_id}@test.local",
        phone="9999999999",
        password="test-password",
        role=UserRole.USER,
        active=True,
    )

    recipient = User(
        name="Recipient",
        lastname="Test",
        position="Collaborator",
        company_name="Other Company",
        email=f"recipient-{unique_id}@test.local",
        phone="9999999999",
        password="test-password",
        role=UserRole.USER,
        active=True,
    )

    db_session.add_all([company, inviter, recipient])
    db_session.flush()

    membership = CompanyMembership(
        company_id=company.id,
        user_id=inviter.id,
        role=CompanyRole.COMPANY_ADMIN,
        status=CompanyMembershipStatus.ACTIVE,
    )

    db_session.add(membership)
    db_session.flush()

    return {
        "company": company,
        "inviter": inviter,
        "recipient": recipient,
    }


def test_create_invitation_success(db_session):
    data = create_invitation_data(db_session)

    service = CompanyInvitationService()

    before = datetime.now(timezone.utc)

    invitation, token = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email.upper(),
    )

    after = datetime.now(timezone.utc)

    assert invitation.id is not None
    assert invitation.company_id == data["company"].id
    assert invitation.invited_by_user_id == data["inviter"].id

    assert invitation.email == data["recipient"].email
    assert invitation.status == CompanyInvitationStatus.PENDING

    assert token
    assert invitation.token_hash == service._hash_token(token)
    assert invitation.token_hash != token

    assert (
        before + timedelta(days=7)
        <= invitation.expires_at
        <= after + timedelta(days=7)
    )

    stored_invitation = db_session.get(
        CompanyInvitation,
        invitation.id,
    )

    assert stored_invitation is not None
    assert stored_invitation.token_hash == invitation.token_hash

    assert (
        db_session.query(CompanyMembership)
        .filter(
            CompanyMembership.user_id == data["recipient"].id,
            CompanyMembership.company_id == data["company"].id,
        )
        .count()
        == 0
    )

    # Verificar el evento de auditoría de creación.
    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "company_invitation.created",
            AuditLog.resource_type == "company_invitation",
            AuditLog.resource_id == invitation.id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == data["inviter"].id
    assert audit_event.company_id == data["company"].id
    assert audit_event.context == {
        "role": CompanyRole.COLLABORATOR.value,
        "status": CompanyInvitationStatus.PENDING.value,
    }
    assert audit_event.created_at is not None

    # No almacenar información sensible en el contexto.
    assert "email" not in audit_event.context
    assert "token" not in audit_event.context
    assert "token_hash" not in audit_event.context

@pytest.mark.parametrize(
    "role",
    [
        CompanyRole.COMPANY_ADMIN,
        CompanyRole.ASG_MANAGER,
        CompanyRole.COLLABORATOR,
        CompanyRole.AUDITOR,
    ],
)
def test_create_invitation_assigns_requested_role(
    db_session,
    role,
):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    invitation, token = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
        role=role,
    )

    assert token
    assert invitation.role == role
    assert invitation.status == CompanyInvitationStatus.PENDING

    db_session.refresh(invitation)

    assert invitation.role == role

@pytest.mark.parametrize(
    "scenario, expected_status",
    [
        ("inactive_inviter", 403),
        ("no_membership", 403),
        ("inactive_company", 404),
        ("inactive_recipient", 404),
        ("existing_membership", 409),
        ("duplicate_invitation", 409),
    ],
)
def test_create_invitation_rejects_invalid_requests(
    db_session,
    scenario,
    expected_status,
):
    data = create_invitation_data(db_session)

    company = data["company"]
    inviter = data["inviter"]
    recipient = data["recipient"]

    if scenario == "inactive_inviter":
        inviter.active = False

    elif scenario == "no_membership":
        db_session.query(CompanyMembership).filter(
            CompanyMembership.user_id == inviter.id,
            CompanyMembership.company_id == company.id,
        ).delete(synchronize_session=False)

    elif scenario == "inactive_company":
        company.active = False

    elif scenario == "inactive_recipient":
        recipient.active = False

    elif scenario == "existing_membership":
        db_session.add(
            CompanyMembership(
                user_id=recipient.id,
                company_id=company.id,
                status=CompanyMembershipStatus.ACTIVE,
            )
        )

    elif scenario == "duplicate_invitation":
        service = CompanyInvitationService()

        service.create_invitation(
            db=db_session,
            company_id=company.id,
            invited_by_user_id=inviter.id,
            email=recipient.email,
        )

    db_session.flush()

    service = CompanyInvitationService()

    with pytest.raises(HTTPException) as exc:
        service.create_invitation(
            db=db_session,
            company_id=company.id,
            invited_by_user_id=inviter.id,
            email=recipient.email,
        )

    assert exc.value.status_code == expected_status


def test_create_invitation_expires_previous_pending_invitation(
    db_session,
):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    previous_invitation, previous_token = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
    )

    previous_invitation.expires_at = (
        datetime.now(timezone.utc) - timedelta(days=1)
    )
    db_session.commit()

    previous_id = previous_invitation.id
    previous_hash = previous_invitation.token_hash

    new_invitation, new_token = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
    )

    db_session.expire_all()

    previous_stored = db_session.get(
        CompanyInvitation,
        previous_id,
    )

    new_stored = db_session.get(
        CompanyInvitation,
        new_invitation.id,
    )

    assert previous_stored.status == CompanyInvitationStatus.EXPIRED

    assert new_stored.status == CompanyInvitationStatus.PENDING
    assert new_stored.id != previous_id

    assert new_token != previous_token
    assert new_stored.token_hash != previous_hash

    assert (
        db_session.query(CompanyInvitation)
        .filter(
            CompanyInvitation.company_id == data["company"].id,
            CompanyInvitation.email == data["recipient"].email,
            CompanyInvitation.status == CompanyInvitationStatus.PENDING,
        )
        .count()
        == 1
    )


def test_create_invitation_handles_duplicate_integrity_error(
    db_session,
):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    class FakeDiagnostics:
        constraint_name = (
            "uq_company_invitations_pending_company_email"
        )

    class FakeDatabaseError:
        diag = FakeDiagnostics()

    integrity_error = IntegrityError(
        statement="INSERT INTO company_invitations",
        params={},
        orig=FakeDatabaseError(),
    )

    with patch.object(
        db_session,
        "commit",
        side_effect=integrity_error,
    ), patch.object(
        db_session,
        "rollback",
        wraps=db_session.rollback,
    ) as mock_rollback:

        with pytest.raises(HTTPException) as exc:
            service.create_invitation(
                db=db_session,
                company_id=data["company"].id,
                invited_by_user_id=data["inviter"].id,
                email=data["recipient"].email,
            )

        mock_rollback.assert_called_once()

    assert exc.value.status_code == 409
    assert exc.value.detail == (
        "An active invitation already exists"
    )

    assert (
        db_session.query(CompanyInvitation)
        .filter(
            CompanyInvitation.company_id == data["company"].id,
            CompanyInvitation.email == data["recipient"].email,
        )
        .count()
        == 0
    )


def test_accept_invitation_creates_active_membership(db_session):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    invitation, token = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
    )

    membership = service.accept_invitation(
        db=db_session,
        token=token,
        current_user_id=data["recipient"].id,
    )

    assert membership.id is not None
    assert membership.user_id == data["recipient"].id
    assert membership.company_id == data["company"].id
    assert membership.status == CompanyMembershipStatus.ACTIVE
    assert membership.role == CompanyRole.COLLABORATOR

    db_session.refresh(invitation)

    assert invitation.status == CompanyInvitationStatus.ACCEPTED
    assert invitation.accepted_at is not None

    # Verificar la auditoría de aceptación de la invitación.
    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "company_invitation.accepted",
            AuditLog.resource_type == "company_invitation",
            AuditLog.resource_id == invitation.id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == data["recipient"].id
    assert audit_event.company_id == data["company"].id
    assert audit_event.context == {
        "membership_id": membership.id,
        "role": CompanyRole.COLLABORATOR.value,
        "status": CompanyInvitationStatus.ACCEPTED.value,
    }
    assert audit_event.created_at is not None

    # Verificar que no se almacenan datos sensibles.
    assert "email" not in audit_event.context
    assert "token" not in audit_event.context
    assert "token_hash" not in audit_event.context

    stored_memberships = (
        db_session.query(CompanyMembership)
        .filter(
            CompanyMembership.user_id == data["recipient"].id,
            CompanyMembership.company_id == data["company"].id,
        )
        .all()
    )

    assert len(stored_memberships) == 1
    assert stored_memberships[0].id == membership.id

    assert (
        db_session.query(User)
        .filter(User.email == data["recipient"].email)
        .count()
        == 1
    )

    with pytest.raises(HTTPException) as exc:
        service.accept_invitation(
            db=db_session,
            token=token,
            current_user_id=data["recipient"].id,
        )

    assert exc.value.status_code == 409


def test_accept_invitation_reactivates_inactive_membership(
    db_session,
):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    existing_membership = CompanyMembership(
        user_id=data["recipient"].id,
        company_id=data["company"].id,
        role=CompanyRole.ASG_MANAGER,
        status=CompanyMembershipStatus.INACTIVE,
    )

    db_session.add(existing_membership)
    db_session.flush()

    original_membership_id = existing_membership.id

    invitation, token = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
        role=CompanyRole.AUDITOR,
    )

    membership = service.accept_invitation(
        db=db_session,
        token=token,
        current_user_id=data["recipient"].id,
    )

    assert membership.id == original_membership_id
    assert membership.status == CompanyMembershipStatus.ACTIVE
    assert membership.role == CompanyRole.AUDITOR

    db_session.refresh(invitation)

    assert invitation.status == CompanyInvitationStatus.ACCEPTED
    assert invitation.accepted_at is not None

    memberships = (
        db_session.query(CompanyMembership)
        .filter(
            CompanyMembership.user_id == data["recipient"].id,
            CompanyMembership.company_id == data["company"].id,
        )
        .all()
    )

    assert len(memberships) == 1
    assert memberships[0].id == original_membership_id

    # Verificar la auditoría de aceptación con reactivación.
    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "company_invitation.accepted",
            AuditLog.resource_type == "company_invitation",
            AuditLog.resource_id == invitation.id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == data["recipient"].id
    assert audit_event.company_id == data["company"].id
    assert audit_event.context == {
        "membership_id": original_membership_id,
        "role": CompanyRole.AUDITOR.value,
        "status": CompanyInvitationStatus.ACCEPTED.value,
    }
    assert audit_event.created_at is not None

    # El evento debe referenciar la membresía original.
    assert audit_event.context["membership_id"] == membership.id

    # El contexto no debe contener información sensible.
    assert "email" not in audit_event.context
    assert "token" not in audit_event.context
    assert "token_hash" not in audit_event.context

@pytest.mark.parametrize(
    "role",
    [
        CompanyRole.COMPANY_ADMIN,
        CompanyRole.ASG_MANAGER,
        CompanyRole.COLLABORATOR,
        CompanyRole.AUDITOR,
    ],
)
def test_accept_invitation_assigns_requested_role(
    db_session,
    role,
):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    invitation, token = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
        role=role,
    )

    membership = service.accept_invitation(
        db=db_session,
        token=token,
        current_user_id=data["recipient"].id,
    )

    assert membership.status == CompanyMembershipStatus.ACTIVE
    assert membership.role == role

    db_session.refresh(membership)
    db_session.refresh(invitation)

    assert membership.role == role
    assert invitation.role == role
    assert invitation.status == CompanyInvitationStatus.ACCEPTED
    assert invitation.accepted_at is not None

@pytest.mark.parametrize(
    "scenario, expected_status",
    [
        ("invalid_token", 404),
        ("wrong_recipient", 403),
        ("inactive_recipient", 403),
        ("inactive_company", 403),
        ("expired_token", 410),
        ("already_active_member", 409),
    ],
)
def test_accept_invitation_rejects_invalid_requests(
    db_session,
    scenario,
    expected_status,
):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    invitation, token = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
    )

    current_user_id = data["recipient"].id

    if scenario == "invalid_token":
        token = "invalid-invitation-token"

    elif scenario == "wrong_recipient":
        current_user_id = data["inviter"].id

    elif scenario == "inactive_recipient":
        data["recipient"].active = False

    elif scenario == "inactive_company":
        data["company"].active = False

    elif scenario == "expired_token":
        invitation.expires_at = (
            datetime.now(timezone.utc) - timedelta(days=1)
        )

    elif scenario == "already_active_member":
        db_session.add(
            CompanyMembership(
                user_id=data["recipient"].id,
                company_id=data["company"].id,
                status=CompanyMembershipStatus.ACTIVE,
            )
        )

    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        service.accept_invitation(
            db=db_session,
            token=token,
            current_user_id=current_user_id,
        )

    assert exc.value.status_code == expected_status

    db_session.expire_all()

    stored_invitation = db_session.get(
        CompanyInvitation,
        invitation.id,
    )

    if scenario == "expired_token":
        assert (
            stored_invitation.status
            == CompanyInvitationStatus.EXPIRED
        )
    else:
        assert (
            stored_invitation.status
            == CompanyInvitationStatus.PENDING
        )

    assert stored_invitation.accepted_at is None

    # Una aceptación rechazada no debe generar auditoría de éxito.
    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "company_invitation.accepted",
            AuditLog.resource_type == "company_invitation",
            AuditLog.resource_id == invitation.id,
        )
        .all()
    )

    assert audit_events == []


def test_create_and_send_invitation_success(db_session):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    with patch.object(
        CompanyInvitationEmailService,
        "ensure_available",
    ) as mock_ensure_available, patch.object(
        CompanyInvitationEmailService,
        "send",
    ) as mock_send:

        invitation = service.create_and_send_invitation(
            db=db_session,
            company_id=data["company"].id,
            invited_by_user_id=data["inviter"].id,
            email=data["recipient"].email,
        )

    mock_ensure_available.assert_called_once()
    mock_send.assert_called_once()

    assert isinstance(invitation, CompanyInvitation)
    assert invitation.status == CompanyInvitationStatus.PENDING
    assert invitation.email == data["recipient"].email

    send_kwargs = mock_send.call_args.kwargs

    assert send_kwargs["recipient"] == data["recipient"].email
    assert send_kwargs["company_name"] == data["company"].name

    token = send_kwargs["token"]

    assert isinstance(token, str)
    assert len(token) > 0

    assert invitation.token_hash == service._hash_token(token)
    assert token != invitation.token_hash

    stored_invitation = db_session.get(
        CompanyInvitation,
        invitation.id,
    )

    assert stored_invitation is not None
    assert stored_invitation.status == CompanyInvitationStatus.PENDING


def test_create_and_send_invitation_rejects_disabled_smtp(
    db_session,
):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    with patch.object(
        CompanyInvitationEmailService,
        "ensure_available",
        side_effect=RuntimeError("SMTP is disabled"),
    ), patch.object(
        CompanyInvitationEmailService,
        "send",
    ) as mock_send:

        with pytest.raises(
            RuntimeError,
            match="SMTP is disabled",
        ):
            service.create_and_send_invitation(
                db=db_session,
                company_id=data["company"].id,
                invited_by_user_id=data["inviter"].id,
                email=data["recipient"].email,
            )

        mock_send.assert_not_called()

    invitations = (
        db_session.query(CompanyInvitation)
        .filter(
            CompanyInvitation.company_id == data["company"].id,
            CompanyInvitation.email == data["recipient"].email,
        )
        .all()
    )

    assert invitations == []


def test_create_and_send_invitation_handles_email_failure(
    db_session,
):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    with patch.object(
        CompanyInvitationEmailService,
        "ensure_available",
    ), patch.object(
        CompanyInvitationEmailService,
        "send",
        side_effect=OSError("SMTP connection failed"),
    ) as mock_send:

        with pytest.raises(HTTPException) as exc:
            service.create_and_send_invitation(
                db=db_session,
                company_id=data["company"].id,
                invited_by_user_id=data["inviter"].id,
                email=data["recipient"].email,
            )

        mock_send.assert_called_once()

    assert exc.value.status_code == 503
    assert exc.value.detail == (
        "Invitation was created, but email "
        "delivery could not be completed"
    )

    db_session.expire_all()

    invitations = (
        db_session.query(CompanyInvitation)
        .filter(
            CompanyInvitation.company_id == data["company"].id,
            CompanyInvitation.email == data["recipient"].email,
        )
        .all()
    )

    assert len(invitations) == 1

    invitation = invitations[0]

    assert invitation.status == CompanyInvitationStatus.PENDING
    assert len(invitation.token_hash) == 64
    assert invitation.accepted_at is None

    recipient_memberships = (
        db_session.query(CompanyMembership)
        .filter(
            CompanyMembership.user_id == data["recipient"].id,
            CompanyMembership.company_id == data["company"].id,
        )
        .all()
    )

    assert recipient_memberships == []


def test_resend_invitation_rotates_token(db_session):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    invitation, original_token = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
        role=CompanyRole.ASG_MANAGER,
    )

    original_id = invitation.id
    original_hash = invitation.token_hash
    original_expiration = invitation.expires_at

    with patch.object(
        CompanyInvitationEmailService,
        "ensure_available",
    ), patch.object(
        CompanyInvitationEmailService,
        "send",
    ) as mock_send:

        resent_invitation = service.resend_invitation(
            db=db_session,
            invitation_id=original_id,
            requested_by_user_id=data["inviter"].id,
        )

    mock_send.assert_called_once()

    new_token = mock_send.call_args.kwargs["token"]

    assert resent_invitation.id == original_id
    assert resent_invitation.role == CompanyRole.ASG_MANAGER
    assert resent_invitation.status == CompanyInvitationStatus.PENDING
    assert resent_invitation.token_hash != original_hash
    assert resent_invitation.token_hash == service._hash_token(new_token)
    assert new_token != original_token
    assert resent_invitation.expires_at > original_expiration

    assert mock_send.call_args.kwargs["recipient"] == (
        data["recipient"].email
    )

    assert (
        db_session.query(CompanyInvitation)
        .filter(CompanyInvitation.id == original_id)
        .count()
        == 1
    )

    # Verificar la auditoría del reenvío.
    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "company_invitation.resent",
            AuditLog.resource_type == "company_invitation",
            AuditLog.resource_id == original_id,
        )
        .all()
    )

    assert len(audit_events) == 1

    audit_event = audit_events[0]

    assert audit_event.actor_id == data["inviter"].id
    assert audit_event.company_id == data["company"].id
    assert audit_event.context == {
        "status": CompanyInvitationStatus.PENDING.value,
        "role": CompanyRole.ASG_MANAGER.value,
    }
    assert audit_event.created_at is not None

    # El contexto no debe incluir credenciales ni datos sensibles.
    assert "email" not in audit_event.context
    assert "token" not in audit_event.context
    assert "token_hash" not in audit_event.context

    with pytest.raises(HTTPException) as exc:
        service.accept_invitation(
            db=db_session,
            token=original_token,
            current_user_id=data["recipient"].id,
        )

    assert exc.value.status_code == 404

    db_session.refresh(resent_invitation)

    assert resent_invitation.status == CompanyInvitationStatus.PENDING
    assert resent_invitation.role == CompanyRole.ASG_MANAGER


@pytest.mark.parametrize(
    "scenario, expected_status",
    [
        ("unauthorized_user", 403),
        ("inactive_requester", 403),
        ("accepted_invitation", 409),
        ("nonexistent_invitation", 404),
    ],
)
def test_resend_invitation_rejects_invalid_requests(
    db_session,
    scenario,
    expected_status,
):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    invitation, original_token = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
    )

    invitation_id = invitation.id
    original_hash = invitation.token_hash
    requested_by_user_id = data["inviter"].id

    if scenario == "unauthorized_user":
        requested_by_user_id = data["recipient"].id

    elif scenario == "inactive_requester":
        data["inviter"].active = False

    elif scenario == "accepted_invitation":
        service.accept_invitation(
            db=db_session,
            token=original_token,
            current_user_id=data["recipient"].id,
        )

    elif scenario == "nonexistent_invitation":
        invitation_id = -1

    db_session.commit()

    with patch.object(
        CompanyInvitationEmailService,
        "ensure_available",
    ), patch.object(
        CompanyInvitationEmailService,
        "send",
    ) as mock_send:

        with pytest.raises(HTTPException) as exc:
            service.resend_invitation(
                db=db_session,
                invitation_id=invitation_id,
                requested_by_user_id=requested_by_user_id,
            )

        mock_send.assert_not_called()

    assert exc.value.status_code == expected_status

    db_session.expire_all()

    stored_invitation = db_session.get(
        CompanyInvitation,
        invitation.id,
    )

    assert stored_invitation.token_hash == original_hash

    if scenario == "accepted_invitation":
        assert (
            stored_invitation.status
            == CompanyInvitationStatus.ACCEPTED
        )
    else:
        assert (
            stored_invitation.status
            == CompanyInvitationStatus.PENDING
        )


def test_resend_invitation_enforces_cooldown(db_session):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    invitation, _ = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
    )

    with patch.object(
        CompanyInvitationEmailService,
        "ensure_available",
    ), patch.object(
        CompanyInvitationEmailService,
        "send",
    ) as mock_send:

        service.resend_invitation(
            db=db_session,
            invitation_id=invitation.id,
            requested_by_user_id=data["inviter"].id,
        )

        db_session.refresh(invitation)

        first_resend_hash = invitation.token_hash
        first_resend_time = invitation.last_resent_at

        assert first_resend_time is not None

        with pytest.raises(HTTPException) as exc:
            service.resend_invitation(
                db=db_session,
                invitation_id=invitation.id,
                requested_by_user_id=data["inviter"].id,
            )

        assert exc.value.status_code == 429
        assert exc.value.detail == (
            "Invitation resend cooldown is active"
        )

        assert "Retry-After" in exc.value.headers
        assert int(exc.value.headers["Retry-After"]) > 0

        mock_send.assert_called_once()

    db_session.refresh(invitation)

    assert invitation.token_hash == first_resend_hash
    assert invitation.last_resent_at == first_resend_time
    assert invitation.status == CompanyInvitationStatus.PENDING


def test_resend_invitation_allowed_after_cooldown(db_session):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    invitation, _ = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
    )

    with patch.object(
        CompanyInvitationEmailService,
        "ensure_available",
    ), patch.object(
        CompanyInvitationEmailService,
        "send",
    ) as mock_send:

        service.resend_invitation(
            db=db_session,
            invitation_id=invitation.id,
            requested_by_user_id=data["inviter"].id,
        )

        db_session.refresh(invitation)

        first_token_hash = invitation.token_hash
        first_resend_time = invitation.last_resent_at

        # Simulamos que el intervalo de seguridad ya transcurrió.
        invitation.last_resent_at = (
            datetime.now(timezone.utc) - timedelta(minutes=6)
        )
        db_session.commit()

        resent_invitation = service.resend_invitation(
            db=db_session,
            invitation_id=invitation.id,
            requested_by_user_id=data["inviter"].id,
        )

        assert mock_send.call_count == 2

    db_session.refresh(resent_invitation)

    assert resent_invitation.id == invitation.id
    assert resent_invitation.status == CompanyInvitationStatus.PENDING
    assert resent_invitation.token_hash != first_token_hash
    assert resent_invitation.last_resent_at > first_resend_time

    new_token = mock_send.call_args.kwargs["token"]

    assert resent_invitation.token_hash == service._hash_token(
        new_token
    )

    assert (
        db_session.query(CompanyInvitation)
        .filter(
            CompanyInvitation.company_id == data["company"].id,
            CompanyInvitation.email == data["recipient"].email,
            CompanyInvitation.status == CompanyInvitationStatus.PENDING,
        )
        .count()
        == 1
    )


def test_resend_invitation_handles_email_failure(db_session):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    invitation, original_token = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
    )

    original_id = invitation.id
    original_hash = invitation.token_hash

    with patch.object(
        CompanyInvitationEmailService,
        "ensure_available",
    ), patch.object(
        CompanyInvitationEmailService,
        "send",
        side_effect=OSError("SMTP connection failed"),
    ) as mock_send:

        with pytest.raises(HTTPException) as exc:
            service.resend_invitation(
                db=db_session,
                invitation_id=original_id,
                requested_by_user_id=data["inviter"].id,
            )

        mock_send.assert_called_once()

    assert exc.value.status_code == 503
    assert exc.value.detail == (
        "Invitation was updated, but email "
        "delivery could not be completed"
    )

    db_session.expire_all()

    stored_invitation = db_session.get(
        CompanyInvitation,
        original_id,
    )

    assert stored_invitation is not None
    assert stored_invitation.status == CompanyInvitationStatus.PENDING
    assert stored_invitation.token_hash != original_hash
    assert stored_invitation.last_resent_at is not None

    attempted_token = mock_send.call_args.kwargs["token"]

    assert stored_invitation.token_hash == service._hash_token(
        attempted_token
    )

    with pytest.raises(HTTPException) as token_exc:
        service.accept_invitation(
            db=db_session,
            token=original_token,
            current_user_id=data["recipient"].id,
        )

    assert token_exc.value.status_code == 404


def test_resend_invitation_recovers_after_email_failure(db_session):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    invitation, original_token = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
    )

    with patch.object(
        CompanyInvitationEmailService,
        "ensure_available",
    ), patch.object(
        CompanyInvitationEmailService,
        "send",
        side_effect=OSError("SMTP connection failed"),
    ):
        with pytest.raises(HTTPException) as exc:
            service.resend_invitation(
                db=db_session,
                invitation_id=invitation.id,
                requested_by_user_id=data["inviter"].id,
            )

    assert exc.value.status_code == 503

    db_session.refresh(invitation)

    failed_token_hash = invitation.token_hash

    assert failed_token_hash != service._hash_token(original_token)

    # Simulamos que han transcurrido más de cinco minutos.
    invitation.last_resent_at = (
        datetime.now(timezone.utc) - timedelta(minutes=6)
    )
    db_session.commit()

    with patch.object(
        CompanyInvitationEmailService,
        "ensure_available",
    ), patch.object(
        CompanyInvitationEmailService,
        "send",
    ) as mock_send:

        recovered_invitation = service.resend_invitation(
            db=db_session,
            invitation_id=invitation.id,
            requested_by_user_id=data["inviter"].id,
        )

    mock_send.assert_called_once()

    recovered_token = mock_send.call_args.kwargs["token"]

    assert recovered_invitation.id == invitation.id
    assert recovered_invitation.status == CompanyInvitationStatus.PENDING
    assert recovered_invitation.token_hash != failed_token_hash
    assert recovered_invitation.token_hash == service._hash_token(
        recovered_token
    )

    membership = service.accept_invitation(
        db=db_session,
        token=recovered_token,
        current_user_id=data["recipient"].id,
    )

    assert membership.status == CompanyMembershipStatus.ACTIVE

    db_session.refresh(invitation)

    assert invitation.status == CompanyInvitationStatus.ACCEPTED
    assert invitation.accepted_at is not None


def test_accept_invitation_handles_membership_integrity_error(
    db_session,
):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    invitation, token = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
    )

    invitation_id = invitation.id

    class FakeDiagnostics:
        constraint_name = "uq_company_membership_user_company"

    class FakeDatabaseError:
        diag = FakeDiagnostics()

    integrity_error = IntegrityError(
        statement="INSERT INTO company_memberships",
        params={},
        orig=FakeDatabaseError(),
    )

    with patch.object(
        db_session,
        "commit",
        side_effect=integrity_error,
    ), patch.object(
        db_session,
        "rollback",
        wraps=db_session.rollback,
    ) as mock_rollback:

        with pytest.raises(HTTPException) as exc:
            service.accept_invitation(
                db=db_session,
                token=token,
                current_user_id=data["recipient"].id,
            )

        mock_rollback.assert_called_once()

    assert exc.value.status_code == 409
    assert exc.value.detail == (
        "User is already a member of this company"
    )

    db_session.expire_all()

    stored_invitation = db_session.get(
        CompanyInvitation,
        invitation_id,
    )

    assert stored_invitation.status == CompanyInvitationStatus.PENDING
    assert stored_invitation.accepted_at is None

    membership = (
        db_session.query(CompanyMembership)
        .filter(
            CompanyMembership.user_id == data["recipient"].id,
            CompanyMembership.company_id == data["company"].id,
        )
        .first()
    )

    assert membership is None


@pytest.mark.parametrize(
    "role",
    [
        CompanyRole.ASG_MANAGER,
        CompanyRole.COLLABORATOR,
        CompanyRole.AUDITOR,
    ],
)
def test_create_invitation_rejects_non_admin_roles(
    db_session,
    role,
):
    data = create_invitation_data(db_session)

    membership = (
        db_session.query(CompanyMembership)
        .filter(
            CompanyMembership.user_id == data["inviter"].id,
            CompanyMembership.company_id == data["company"].id,
        )
        .one()
    )

    membership.role = role
    db_session.flush()

    service = CompanyInvitationService()

    with pytest.raises(HTTPException) as exc:
        service.create_invitation(
            db=db_session,
            company_id=data["company"].id,
            invited_by_user_id=data["inviter"].id,
            email=data["recipient"].email,
        )

    assert exc.value.status_code == 403
    assert exc.value.detail == "Insufficient company permissions"


@pytest.mark.parametrize(
    "role",
    [
        CompanyRole.ASG_MANAGER,
        CompanyRole.COLLABORATOR,
        CompanyRole.AUDITOR,
    ],
)
def test_resend_invitation_rejects_non_admin_roles(
    db_session,
    role,
):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    invitation, _ = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
    )

    membership = (
        db_session.query(CompanyMembership)
        .filter(
            CompanyMembership.user_id == data["inviter"].id,
            CompanyMembership.company_id == data["company"].id,
        )
        .one()
    )

    membership.role = role
    db_session.flush()

    with patch.object(
        CompanyInvitationEmailService,
        "ensure_available",
    ):
        with pytest.raises(HTTPException) as exc:
            service.resend_invitation(
                db=db_session,
                invitation_id=invitation.id,
                requested_by_user_id=data["inviter"].id,
            )

    assert exc.value.status_code == 403
    assert exc.value.detail == "Insufficient company permissions"


# HU-042: notificaciones de creación de invitaciones.

from app.models.notification_model import (
    Notification,
    NotificationChannel,
    NotificationStatus,
)
from app.models.notification_event_preference_model import (
    NotificationEventPreference,
)
from app.models.notification_preference_model import (
    NotificationPreference,
)


def test_create_invitation_generates_recipient_notification(
    db_session,
):
    data = create_invitation_data(db_session)

    invitation, token = CompanyInvitationService().create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
    )

    notifications = (
        db_session.query(Notification)
        .filter(
            Notification.event_type == "COMPANY_INVITATION_CREATED",
            Notification.resource_type == "company_invitation",
            Notification.resource_id == invitation.id,
        )
        .all()
    )

    assert len(notifications) == 1

    notification = notifications[0]

    assert notification.user_id == data["recipient"].id
    assert notification.user_id != data["inviter"].id
    assert notification.company_id == data["company"].id
    assert notification.channel == NotificationChannel.IN_APP
    assert notification.status == NotificationStatus.PENDING
    assert notification.deduplication_key == (
        f"company_invitation:{invitation.id}:created"
    )
    assert notification.read_at is None

    assert token not in notification.title
    assert token not in notification.message
    assert invitation.token_hash not in notification.title
    assert invitation.token_hash not in notification.message


@pytest.mark.parametrize(
    "preference_scope",
    ["global", "event"],
)
def test_create_invitation_respects_notification_preferences(
    db_session,
    preference_scope,
):
    data = create_invitation_data(db_session)

    if preference_scope == "global":
        preference = NotificationPreference(
            user_id=data["recipient"].id,
            in_app_enabled=False,
            email_enabled=True,
        )
    else:
        preference = NotificationEventPreference(
            user_id=data["recipient"].id,
            event_type="COMPANY_INVITATION_CREATED",
            in_app_enabled=False,
            email_enabled=True,
        )

    db_session.add(preference)
    db_session.flush()

    invitation, token = CompanyInvitationService().create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
    )

    assert invitation.id is not None
    assert token
    assert invitation.status == CompanyInvitationStatus.PENDING

    notifications = (
        db_session.query(Notification)
        .filter(
            Notification.user_id == data["recipient"].id,
            Notification.event_type == "COMPANY_INVITATION_CREATED",
        )
        .all()
    )

    assert notifications == []

    audit_events = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "company_invitation.created",
            AuditLog.resource_id == invitation.id,
        )
        .all()
    )

    assert len(audit_events) == 1


# HU-042: notificaciones de reenvío de invitaciones.


def test_resend_invitation_generates_recipient_notification(
    db_session,
):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    invitation, _ = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
    )

    with patch.object(
        CompanyInvitationEmailService,
        "ensure_available",
    ), patch.object(
        CompanyInvitationEmailService,
        "send",
    ) as mock_send:
        service.resend_invitation(
            db=db_session,
            invitation_id=invitation.id,
            requested_by_user_id=data["inviter"].id,
        )

    notifications = (
        db_session.query(Notification)
        .filter(
            Notification.user_id == data["recipient"].id,
            Notification.event_type == "COMPANY_INVITATION_RESENT",
        )
        .all()
    )

    assert len(notifications) == 1

    notification = notifications[0]

    assert notification.company_id == data["company"].id
    assert notification.channel == NotificationChannel.IN_APP
    assert notification.status == NotificationStatus.PENDING
    assert notification.resource_type == "company_invitation"
    assert notification.resource_id == invitation.id

    assert notification.deduplication_key.startswith(
        f"company_invitation:{invitation.id}:resent:"
    )

    token = mock_send.call_args.kwargs["token"]

    assert token not in notification.message
    assert invitation.token_hash not in notification.message

    mock_send.assert_called_once()


def test_resend_invitation_respects_event_preferences(
    db_session,
):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    invitation, _ = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
    )

    db_session.add(
        NotificationEventPreference(
            user_id=data["recipient"].id,
            event_type="COMPANY_INVITATION_RESENT",
            in_app_enabled=False,
            email_enabled=False,
        )
    )
    db_session.flush()

    with patch.object(
        CompanyInvitationEmailService,
        "ensure_available",
    ), patch.object(
        CompanyInvitationEmailService,
        "send",
    ) as mock_send:
        service.resend_invitation(
            db=db_session,
            invitation_id=invitation.id,
            requested_by_user_id=data["inviter"].id,
        )

    assert (
        db_session.query(Notification)
        .filter(
            Notification.user_id == data["recipient"].id,
            Notification.event_type == "COMPANY_INVITATION_RESENT",
        )
        .count()
    ) == 0

    mock_send.assert_called_once()


def test_multiple_resends_generate_distinct_notifications(
    db_session,
):
    data = create_invitation_data(db_session)
    service = CompanyInvitationService()

    invitation, _ = service.create_invitation(
        db=db_session,
        company_id=data["company"].id,
        invited_by_user_id=data["inviter"].id,
        email=data["recipient"].email,
    )

    with patch.object(
        CompanyInvitationEmailService,
        "ensure_available",
    ), patch.object(
        CompanyInvitationEmailService,
        "send",
    ) as mock_send:

        service.resend_invitation(
            db=db_session,
            invitation_id=invitation.id,
            requested_by_user_id=data["inviter"].id,
        )

        invitation.last_resent_at = (
            datetime.now(timezone.utc) - timedelta(minutes=6)
        )
        db_session.commit()

        service.resend_invitation(
            db=db_session,
            invitation_id=invitation.id,
            requested_by_user_id=data["inviter"].id,
        )

    notifications = (
        db_session.query(Notification)
        .filter(
            Notification.user_id == data["recipient"].id,
            Notification.event_type == "COMPANY_INVITATION_RESENT",
        )
        .all()
    )

    assert len(notifications) == 2

    assert len({
        notification.deduplication_key
        for notification in notifications
    }) == 2

    assert mock_send.call_count == 2
