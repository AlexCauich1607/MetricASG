
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from app.core.roles import CompanyRole

from fastapi import HTTPException
from sqlalchemy.orm import Session

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
from sqlalchemy.exc import IntegrityError
from app.services.company_invitation_email_service import (
    CompanyInvitationEmailService,
)
from app.core.roles import CompanyRole
from app.core.company_permissions import require_company_role
from app.services.audit_service import AuditService

from app.models.notification_event_preference_request import (
    NotificationEventType,
)
from app.models.notification_model import NotificationChannel
from app.services.notification_service import NotificationService

class CompanyInvitationService:
    INVITATION_EXPIRATION_DAYS = 7
    RESEND_COOLDOWN_MINUTES = 5

    @staticmethod
    def _hash_token(token: str) -> str:
        return hashlib.sha256(
            token.encode("utf-8")
        ).hexdigest()

    @staticmethod
    def _generate_token() -> str:
        return secrets.token_urlsafe(32)

    @staticmethod
    def _normalize_email(email: str) -> str:
        return email.strip().lower()

    @staticmethod
    def _utc_now() -> datetime:
        return datetime.now(timezone.utc)

    def _validate_invitation(
        self,
        db: Session,
        company_id: int,
        invited_by_user_id: int,
        email: str,
        allow_pending_invitation: bool = False,
    ) -> User:
        inviter = db.get(User, invited_by_user_id)

        if not inviter or not inviter.active:
            raise HTTPException(
                status_code=403,
                detail="Inviting user is not active",
            )

        company = db.get(Company, company_id)

        if not company or not company.active:
            raise HTTPException(
                status_code=404,
                detail="Company not found or inactive",
            )

        require_company_role(
            db,
            inviter,
            company_id,
            CompanyRole.COMPANY_ADMIN,
        )

        recipient = (
            db.query(User)
            .filter(
                User.email == email,
                User.active.is_(True),
            )
            .first()
        )

        if not recipient:
            raise HTTPException(
                status_code=404,
                detail="Active recipient account not found",
            )

        existing_membership = (
            db.query(CompanyMembership)
            .filter(
                CompanyMembership.user_id == recipient.id,
                CompanyMembership.company_id == company_id,
                CompanyMembership.status
                == CompanyMembershipStatus.ACTIVE,
            )
            .first()
        )

        if existing_membership:
            raise HTTPException(
                status_code=409,
                detail="Recipient is already an active member",
            )

        pending_invitation = (
            db.query(CompanyInvitation)
            .filter(
                CompanyInvitation.company_id == company_id,
                CompanyInvitation.email == email,
                CompanyInvitation.status
                == CompanyInvitationStatus.PENDING,
                CompanyInvitation.expires_at > self._utc_now(),
            )
            .first()
        )

        if pending_invitation and not allow_pending_invitation:
            raise HTTPException(
                status_code=409,
                detail="An active invitation already exists",
            )

        return recipient

    def _expire_pending_invitations(
        self,
        db: Session,
        company_id: int,
        email: str,
    ) -> None:
        (
            db.query(CompanyInvitation)
            .filter(
                CompanyInvitation.company_id == company_id,
                CompanyInvitation.email == email,
                CompanyInvitation.status
                == CompanyInvitationStatus.PENDING,
                CompanyInvitation.expires_at <= self._utc_now(),
            )
            .update(
                {
                    CompanyInvitation.status:
                        CompanyInvitationStatus.EXPIRED,
                },
                synchronize_session=False,
            )
        )

    def create_invitation(
        self,
        db: Session,
        company_id: int,
        invited_by_user_id: int,
        email: str,
        role: CompanyRole = CompanyRole.COLLABORATOR,
    ) -> tuple[CompanyInvitation, str]:
        normalized_email = self._normalize_email(email)

        recipient = self._validate_invitation(
            db=db,
            company_id=company_id,
            invited_by_user_id=invited_by_user_id,
            email=normalized_email,
        )

        token = self._generate_token()

        invitation = CompanyInvitation(
            company_id=company_id,
            invited_by_user_id=invited_by_user_id,
            email=normalized_email,
            role=role,
            token_hash=self._hash_token(token),
            status=CompanyInvitationStatus.PENDING,
            expires_at=(
                self._utc_now()
                + timedelta(days=self.INVITATION_EXPIRATION_DAYS)
            ),
        )

        try:
            self._expire_pending_invitations(
                db=db,
                company_id=company_id,
                email=normalized_email,
            )

            db.add(invitation)
            db.flush()

            AuditService.record(
                db=db,
                action="company_invitation.created",
                resource_type="company_invitation",
                resource_id=invitation.id,
                actor_id=invited_by_user_id,
                company_id=company_id,
                context={
                    "role": invitation.role.value,
                    "status": CompanyInvitationStatus.PENDING.value,
                },
            )

            NotificationService(db).create(
                user_id=recipient.id,
                company_id=company_id,
                event_type=NotificationEventType.COMPANY_INVITATION_CREATED.value,
                channel=NotificationChannel.IN_APP,
                title="Nueva invitación empresarial",
                message=(
                    "Has recibido una invitación para unirte "
                    "a una empresa en MetricASG."
                ),
                deduplication_key=f"company_invitation:{invitation.id}:created",
                resource_type="company_invitation",
                resource_id=invitation.id,
            )

            db.commit()
            db.refresh(invitation)

        except IntegrityError as exc:
            db.rollback()

            constraint_name = getattr(
                getattr(exc.orig, "diag", None),
                "constraint_name",
                None,
            )

            if (
                constraint_name
                == "uq_company_invitations_pending_company_email"
            ):
                raise HTTPException(
                    status_code=409,
                    detail="An active invitation already exists",
                ) from exc

            raise

        except Exception:
            db.rollback()
            raise

        return invitation, token

    def create_and_send_invitation(
        self,
        db: Session,
        company_id: int,
        invited_by_user_id: int,
        email: str,
        role: CompanyRole = CompanyRole.COLLABORATOR,
    ) -> CompanyInvitation:
        email_service = CompanyInvitationEmailService()

        email_service.ensure_available()

        invitation, token = self.create_invitation(
            db=db,
            company_id=company_id,
            invited_by_user_id=invited_by_user_id,
            email=email,
            role=role,
        )

        company = db.get(Company, company_id)

        try:
            email_service.send(
                recipient=invitation.email,
                company_name=company.name,
                token=token,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Invitation was created, but email "
                    "delivery could not be completed"
                ),
            ) from exc

        return invitation


    def resend_invitation(
        self,
        db: Session,
        invitation_id: int,
        requested_by_user_id: int,
    ) -> CompanyInvitation:
        email_service = CompanyInvitationEmailService()
        email_service.ensure_available()

        try:
            invitation = (
                db.query(CompanyInvitation)
                .filter(
                    CompanyInvitation.id == invitation_id,
                )
                .with_for_update()
                .first()
            )

            if not invitation:
                raise HTTPException(
                    status_code=404,
                    detail="Invitation not found",
                )

            if invitation.status != CompanyInvitationStatus.PENDING:
                raise HTTPException(
                    status_code=409,
                    detail="Invitation is no longer pending",
                )

            recipient = self._validate_invitation(
                db=db,
                company_id=invitation.company_id,
                invited_by_user_id=requested_by_user_id,
                email=invitation.email,
                allow_pending_invitation=True,
            )
            now = self._utc_now()
            if invitation.last_resent_at is not None:
                next_allowed_at = (
                    invitation.last_resent_at
                    + timedelta(minutes=self.RESEND_COOLDOWN_MINUTES)
                )

                if now < next_allowed_at:
                    raise HTTPException(
                        status_code=429,
                        detail="Invitation resend cooldown is active",
                        headers={
                            "Retry-After": str(
                                max(
                                    1,
                                    int(
                                        (
                                            next_allowed_at - now
                                        ).total_seconds()
                                    ) + 1,
                                )
                            )
                        },
                    )
            token = self._generate_token()

            invitation.token_hash = self._hash_token(token)
            invitation.expires_at = now + timedelta(
                days=self.INVITATION_EXPIRATION_DAYS
            )

            invitation.last_resent_at = now

            AuditService.record(
                db=db,
                action="company_invitation.resent",
                resource_type="company_invitation",
                resource_id=invitation.id,
                actor_id=requested_by_user_id,
                company_id=invitation.company_id,
                context={
                    "status": CompanyInvitationStatus.PENDING.value,
                    "role": invitation.role.value,
                },
            )

            NotificationService(db).create(
                user_id=recipient.id,
                company_id=invitation.company_id,
                event_type=NotificationEventType.COMPANY_INVITATION_RESENT.value,
                channel=NotificationChannel.IN_APP,
                title="Invitación empresarial reenviada",
                message=(
                    "Se ha reenviado una invitación para que "
                    "te unas a una empresa en MetricASG."
                ),
                deduplication_key=(
                    f"company_invitation:{invitation.id}:resent:"
                    f"{now.isoformat()}"
                ),
                resource_type="company_invitation",
                resource_id=invitation.id,
            )

            db.commit()
            db.refresh(invitation)

        except Exception:
            db.rollback()
            raise

        company = db.get(Company, invitation.company_id)

        try:
            email_service.send(
                recipient=invitation.email,
                company_name=company.name,
                token=token,
            )

        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Invitation was updated, but email "
                    "delivery could not be completed"
                ),
            ) from exc

        return invitation

    def accept_invitation(
        self,
        db: Session,
        token: str,
        current_user_id: int,
    ) -> CompanyMembership:
        if not token:
            raise HTTPException(
                status_code=400,
                detail="Invitation token is required",
            )

        token_hash = self._hash_token(token)

        try:
            invitation = (
                db.query(CompanyInvitation)
                .filter(
                    CompanyInvitation.token_hash == token_hash,
                )
                .with_for_update()
                .first()
            )

            if not invitation:
                raise HTTPException(
                    status_code=404,
                    detail="Invitation not found",
                )

            if invitation.status != CompanyInvitationStatus.PENDING:
                raise HTTPException(
                    status_code=409,
                    detail="Invitation is no longer pending",
                )

            if invitation.expires_at <= self._utc_now():
                invitation.status = CompanyInvitationStatus.EXPIRED
                db.commit()

                raise HTTPException(
                    status_code=410,
                    detail="Invitation has expired",
                )

            user = db.get(User, current_user_id)

            if not user or not user.active:
                raise HTTPException(
                    status_code=403,
                    detail="Active user account required",
                )

            if self._normalize_email(user.email) != invitation.email:
                raise HTTPException(
                    status_code=403,
                    detail="Invitation belongs to another user",
                )

            company = db.get(Company, invitation.company_id)

            if not company or not company.active:
                raise HTTPException(
                    status_code=403,
                    detail="Company is not active",
                )

            membership = (
                db.query(CompanyMembership)
                .filter(
                    CompanyMembership.user_id == user.id,
                    CompanyMembership.company_id == company.id,
                )
                .with_for_update()
                .first()
            )

            if membership:
                if membership.status == CompanyMembershipStatus.ACTIVE:
                    raise HTTPException(
                        status_code=409,
                        detail="User is already an active member",
                    )

                membership.status = CompanyMembershipStatus.ACTIVE
                membership.role = invitation.role

            else:
                membership = CompanyMembership(
                    user_id=user.id,
                    company_id=company.id,
                    role=invitation.role,
                    status=CompanyMembershipStatus.ACTIVE,
                )

                db.add(membership)

            invitation.status = CompanyInvitationStatus.ACCEPTED
            invitation.accepted_at = self._utc_now()

            db.flush()

            AuditService.record(
                db=db,
                action="company_invitation.accepted",
                resource_type="company_invitation",
                resource_id=invitation.id,
                actor_id=current_user_id,
                company_id=invitation.company_id,
                context={
                    "membership_id": membership.id,
                    "role": membership.role.value,
                    "status": CompanyInvitationStatus.ACCEPTED.value,
                },
            )

            db.commit()
            db.refresh(membership)

            return membership

        except HTTPException:
            db.rollback()
            raise

        except IntegrityError as exc:
            db.rollback()

            constraint_name = getattr(
                getattr(exc.orig, "diag", None),
                "constraint_name",
                None,
            )

            if constraint_name == "uq_company_membership_user_company":
                raise HTTPException(
                    status_code=409,
                    detail="User is already a member of this company",
                ) from exc

            raise

        except Exception:
            db.rollback()
            raise
