
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.roles import CompanyRole
from app.models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)
from app.models.company_model import Company
from app.models.user_model import User


def require_company_role(
    db: Session,
    user: User,
    company_id: int,
    *allowed_roles: CompanyRole,
) -> CompanyMembership:
    if not allowed_roles:
        raise ValueError("At least one company role must be provided")

    if not user.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Active user account required",
        )

    membership = (
        db.query(CompanyMembership)
        .join(
            Company,
            Company.id == CompanyMembership.company_id,
        )
        .filter(
            CompanyMembership.user_id == user.id,
            CompanyMembership.company_id == company_id,
            CompanyMembership.status
            == CompanyMembershipStatus.ACTIVE,
            Company.active.is_(True),
        )
        .first()
    )

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Active company membership required",
        )

    if membership.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient company permissions",
        )

    return membership
