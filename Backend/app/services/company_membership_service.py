
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from ..models.company_model import Company
from ..models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)
from ..models.company_membership_response import (
    CompanyMemberResponse,
    UserCompanyMembershipResponse,
)
from ..models.user_model import User
from app.core.company_permissions import require_company_role
from app.core.roles import CompanyRole

class CompanyMembershipService:

    def list_user_memberships(
        self,
        db: Session,
        current_user_id: int,
    ) -> list[UserCompanyMembershipResponse]:

        current_user = db.get(User, current_user_id)

        if current_user is None or not current_user.active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Active user required",
            )

        memberships = (
            db.query(CompanyMembership)
            .join(
                Company,
                Company.id == CompanyMembership.company_id,
            )
            .filter(
                CompanyMembership.user_id == current_user_id,
                CompanyMembership.status == CompanyMembershipStatus.ACTIVE,
                Company.active.is_(True),
            )
            .order_by(CompanyMembership.id.asc())
            .all()
        )

        return [
            UserCompanyMembershipResponse(
                membership_id=membership.id,
                company_id=membership.company_id,
                company_name=membership.company.name,
                role=membership.role,
                joined_at=membership.joined_at,
            )
            for membership in memberships
        ]

    def list_members(
        self,
        db: Session,
        company_id: int,
        current_user_id: int,
    ) -> list[CompanyMemberResponse]:

        company = (
            db.query(Company)
            .filter(
                Company.id == company_id,
                Company.active.is_(True),
            )
            .first()
        )

        if company is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found",
            )

        requester = db.get(User, current_user_id)

        if requester is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Active company membership required",
            )

        require_company_role(
            db,
            requester,
            company_id,
            CompanyRole.COMPANY_ADMIN,
            CompanyRole.ASG_MANAGER,
            CompanyRole.COLLABORATOR,
        )

        memberships = (
            db.query(CompanyMembership)
            .join(User, User.id == CompanyMembership.user_id)
            .options(joinedload(CompanyMembership.user))
            .filter(
                CompanyMembership.company_id == company_id,
            )
            .order_by(CompanyMembership.id.asc())
            .all()
        )

        return [
            CompanyMemberResponse(
                membership_id=membership.id,
                user_id=membership.user_id,
                name=membership.user.name,
                lastname=membership.user.lastname,
                email=membership.user.email,
                position=membership.user.position,
                role=membership.role,
                status=membership.status,
                joined_at=membership.joined_at,
            )
            for membership in memberships
        ]


    def remove_member(
        self,
        db: Session,
        company_id: int,
        membership_id: int,
        current_user_id: int,
    ) -> CompanyMembership:

        company = (
            db.query(Company)
            .filter(Company.id == company_id)
            .with_for_update()
            .first()
        )

        if company is None or not company.active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found",
            )

        requester = db.get(User, current_user_id)

        if requester is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Active company membership required",
            )

        requester_membership = require_company_role(
            db,
            requester,
            company_id,
            *list(CompanyRole),
        )

        membership = (
            db.query(CompanyMembership)
            .filter(
                CompanyMembership.id == membership_id,
                CompanyMembership.company_id == company_id,
            )
            .first()
        )

        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company membership not found",
            )

        if (
            membership.user_id != current_user_id
            and requester_membership.role
            != CompanyRole.COMPANY_ADMIN
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient company permissions",
            )

        if membership.status != CompanyMembershipStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Company membership is already inactive",
            )

        active_members_count = (
            db.query(CompanyMembership)
            .filter(
                CompanyMembership.company_id == company_id,
                CompanyMembership.status
                == CompanyMembershipStatus.ACTIVE,
            )
            .count()
        )

        if active_members_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot remove the last active company member",
            )

        if membership.role == CompanyRole.COMPANY_ADMIN:
            active_admins_count = (
                db.query(CompanyMembership)
                .join(
                    User,
                    User.id == CompanyMembership.user_id,
                )
                .filter(
                    CompanyMembership.company_id == company_id,
                    CompanyMembership.role == CompanyRole.COMPANY_ADMIN,
                    CompanyMembership.status
                    == CompanyMembershipStatus.ACTIVE,
                    User.active.is_(True),
                )
                .count()
            )

            if active_admins_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Cannot remove the last active company administrator",
                )

        membership.status = CompanyMembershipStatus.INACTIVE

        db.flush()

        return membership
