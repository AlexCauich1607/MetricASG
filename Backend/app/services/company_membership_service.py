
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from ..models.company_model import Company
from ..models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)
from ..models.company_membership_response import CompanyMemberResponse
from ..models.user_model import User


class CompanyMembershipService:

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

        requester_membership = (
            db.query(CompanyMembership)
            .join(User, User.id == CompanyMembership.user_id)
            .filter(
                CompanyMembership.company_id == company_id,
                CompanyMembership.user_id == current_user_id,
                CompanyMembership.status
                == CompanyMembershipStatus.ACTIVE,
                User.active.is_(True),
            )
            .first()
        )

        if requester_membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Active company membership required",
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

        requester_membership = (
            db.query(CompanyMembership)
            .join(User, User.id == CompanyMembership.user_id)
            .filter(
                CompanyMembership.company_id == company_id,
                CompanyMembership.user_id == current_user_id,
                CompanyMembership.status
                == CompanyMembershipStatus.ACTIVE,
                User.active.is_(True),
            )
            .first()
        )

        if requester_membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Active company membership required",
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

        if membership.user_id != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot remove another company member",
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

        membership.status = CompanyMembershipStatus.INACTIVE

        db.flush()

        return membership
