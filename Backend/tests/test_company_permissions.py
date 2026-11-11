
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core.company_permissions import require_company_role
from app.core.roles import CompanyRole
from app.models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)
from app.models.company_model import Company
from app.models.user_model import User


def create_company_membership(
    db_session,
    role=CompanyRole.COLLABORATOR,
    membership_status=CompanyMembershipStatus.ACTIVE,
    user_active=True,
    company_active=True,
):
    unique_id = uuid4().hex

    company = Company(
        name=f"Permission Test Company {unique_id}",
        active=company_active,
    )

    user = User(
        name="Test",
        lastname="Member",
        email=f"permissions-{unique_id}@example.com",
        company_name=company.name,
        password="test-password",
        active=user_active,
    )

    db_session.add_all([company, user])
    db_session.flush()

    membership = CompanyMembership(
        user_id=user.id,
        company_id=company.id,
        role=role,
        status=membership_status,
    )

    db_session.add(membership)
    db_session.flush()

    return company, user, membership


@pytest.mark.parametrize("role", list(CompanyRole))
def test_require_company_role_allows_authorized_membership(
    db_session,
    role,
):
    company, user, membership = create_company_membership(
        db_session,
        role=role,
    )

    result = require_company_role(
        db_session,
        user,
        company.id,
        role,
    )

    assert result.id == membership.id
    assert result.role == role


@pytest.mark.parametrize(
    "role",
    [
        CompanyRole.ASG_MANAGER,
        CompanyRole.COLLABORATOR,
        CompanyRole.AUDITOR,
    ],
)
def test_require_company_role_rejects_insufficient_role(
    db_session,
    role,
):
    company, user, _ = create_company_membership(
        db_session,
        role=role,
    )

    with pytest.raises(HTTPException) as exc:
        require_company_role(
            db_session,
            user,
            company.id,
            CompanyRole.COMPANY_ADMIN,
        )

    assert exc.value.status_code == 403
    assert exc.value.detail == "Insufficient company permissions"


@pytest.mark.parametrize(
    "scenario",
    [
        "inactive_membership",
        "inactive_user",
        "inactive_company",
        "missing_membership",
    ],
)
def test_require_company_role_rejects_invalid_access(
    db_session,
    scenario,
):
    company, user, membership = create_company_membership(
        db_session,
        role=CompanyRole.COMPANY_ADMIN,
        membership_status=(
            CompanyMembershipStatus.INACTIVE
            if scenario == "inactive_membership"
            else CompanyMembershipStatus.ACTIVE
        ),
        user_active=scenario != "inactive_user",
        company_active=scenario != "inactive_company",
    )

    if scenario == "missing_membership":
        db_session.delete(membership)
        db_session.flush()

    with pytest.raises(HTTPException) as exc:
        require_company_role(
            db_session,
            user,
            company.id,
            CompanyRole.COMPANY_ADMIN,
        )

    assert exc.value.status_code == 403


def test_require_company_role_rejects_other_company(
    db_session,
):
    company, user, _ = create_company_membership(
        db_session,
        role=CompanyRole.COMPANY_ADMIN,
    )

    other_company = Company(
        name=f"Other Company {uuid4().hex}",
        active=True,
    )

    db_session.add(other_company)
    db_session.flush()

    with pytest.raises(HTTPException) as exc:
        require_company_role(
            db_session,
            user,
            other_company.id,
            CompanyRole.COMPANY_ADMIN,
        )

    assert exc.value.status_code == 403


def test_require_company_role_uses_role_per_company(
    db_session,
):
    first_company, user, first_membership = (
        create_company_membership(
            db_session,
            role=CompanyRole.COMPANY_ADMIN,
        )
    )

    second_company = Company(
        name=f"Second Company {uuid4().hex}",
        active=True,
    )

    db_session.add(second_company)
    db_session.flush()

    second_membership = CompanyMembership(
        user_id=user.id,
        company_id=second_company.id,
        role=CompanyRole.AUDITOR,
        status=CompanyMembershipStatus.ACTIVE,
    )

    db_session.add(second_membership)
    db_session.flush()

    result = require_company_role(
        db_session,
        user,
        first_company.id,
        CompanyRole.COMPANY_ADMIN,
    )

    assert result.id == first_membership.id

    with pytest.raises(HTTPException) as exc:
        require_company_role(
            db_session,
            user,
            second_company.id,
            CompanyRole.COMPANY_ADMIN,
        )

    assert exc.value.status_code == 403

    result = require_company_role(
        db_session,
        user,
        second_company.id,
        CompanyRole.AUDITOR,
    )

    assert result.id == second_membership.id


def test_require_company_role_rejects_missing_allowed_roles(
    db_session,
):
    company, user, _ = create_company_membership(db_session)

    with pytest.raises(
        ValueError,
        match="At least one company role must be provided",
    ):
        require_company_role(
            db_session,
            user,
            company.id,
        )
