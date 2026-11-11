
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.company_invitation_request import (
    CompanyInvitationAccept,
    CompanyInvitationAcceptedResponse,
    CompanyInvitationCreate,
    CompanyInvitationResponse,
)
from app.models.user_model import User
from app.services.company_invitation_service import (
    CompanyInvitationService,
)
from app.services.token_service import get_current_user


class CompanyInvitationController:
    def __init__(self):
        self.router = APIRouter(
            prefix="/api/company-invitations",
            tags=["Company Invitations"],
        )

        @self.router.post(
            "",
            response_model=CompanyInvitationResponse,
            status_code=status.HTTP_201_CREATED,
        )
        def create_invitation(
            payload: CompanyInvitationCreate,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return CompanyInvitationService().create_and_send_invitation(
                db=db,
                company_id=payload.company_id,
                invited_by_user_id=current_user.id,
                email=payload.email,
                role=payload.role,
            )


        @self.router.post(
            "/accept",
            response_model=CompanyInvitationAcceptedResponse,
        )
        def accept_invitation(
            payload: CompanyInvitationAccept,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            membership = CompanyInvitationService().accept_invitation(
                db=db,
                token=payload.token,
                current_user_id=current_user.id,
            )

            return CompanyInvitationAcceptedResponse(
                membership_id=membership.id,
                company_id=membership.company_id,
                user_id=membership.user_id,
                status=membership.status.value,
            )

        @self.router.post(
            "/{invitation_id}/resend",
            response_model=CompanyInvitationResponse,
        )
        def resend_invitation(
            invitation_id: int,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return CompanyInvitationService().resend_invitation(
                db=db,
                invitation_id=invitation_id,
                requested_by_user_id=current_user.id,
            )
