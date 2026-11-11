
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.company_membership_response import (
    CompanyMemberResponse,
    UserCompanyMembershipResponse,
)
from app.models.user_model import User
from app.services.company_membership_service import (
    CompanyMembershipService,
)
from app.services.token_service import get_current_user

class CompanyMembershipController:
    def __init__(self):
        self.router = APIRouter(
            prefix="/api/companies",
            tags=["Company Memberships"],
        )

        @self.router.get(
            "/me/memberships",
            response_model=list[UserCompanyMembershipResponse],
        )
        def list_my_memberships(
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return CompanyMembershipService().list_user_memberships(
                db=db,
                current_user_id=current_user.id,
            )

        @self.router.get(
            "/{company_id}/members",
            response_model=list[CompanyMemberResponse],
        )
        def list_members(
            company_id: int,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return CompanyMembershipService().list_members(
                db=db,
                company_id=company_id,
                current_user_id=current_user.id,
            )

        @self.router.delete(
            "/{company_id}/members/{membership_id}",
            status_code=status.HTTP_204_NO_CONTENT,
        )
        def remove_member(
            company_id: int,
            membership_id: int,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            try:
                CompanyMembershipService().remove_member(
                    db=db,
                    company_id=company_id,
                    membership_id=membership_id,
                    current_user_id=current_user.id,
                )

                db.commit()

            except Exception:
                db.rollback()
                raise

            return None
