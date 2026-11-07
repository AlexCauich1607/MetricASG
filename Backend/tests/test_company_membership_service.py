
from uuid import uuid4

from app.models.company_model import Company
from app.models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)
from app.models.user_model import User
from app.services.company_membership_service import (
    CompanyMembershipService,
)
import pytest
from fastapi import HTTPException

def test_list_company_members_success(db_session):
    unique_id = uuid4().hex

    company = Company(
        name=f"Test Company {unique_id}",
        active=True,
    )

    requester = User(
        name="Ana",
        lastname="López",
        email=f"requester-{unique_id}@example.com",
        company_name=company.name,
        password="test-password",
        active=True,
    )

    other_user = User(
        name="Carlos",
        lastname="Pérez",
        email=f"member-{unique_id}@example.com",
        company_name=company.name,
        password="test-password",
        active=True,
    )

    db_session.add_all([company, requester, other_user])
    db_session.flush()

    requester_membership = CompanyMembership(
        company_id=company.id,
        user_id=requester.id,
        status=CompanyMembershipStatus.ACTIVE,
    )

    other_membership = CompanyMembership(
        company_id=company.id,
        user_id=other_user.id,
        status=CompanyMembershipStatus.INACTIVE,
    )

    db_session.add_all([
        requester_membership,
        other_membership,
    ])
    db_session.flush()

    service = CompanyMembershipService()

    members = service.list_members(
        db=db_session,
        company_id=company.id,
        current_user_id=requester.id,
    )

    assert len(members) == 2

    members_by_user_id = {
        member.user_id: member
        for member in members
    }

    assert members_by_user_id[requester.id].status == (
        CompanyMembershipStatus.ACTIVE
    )

    assert members_by_user_id[other_user.id].status == (
        CompanyMembershipStatus.INACTIVE
    )

    assert members_by_user_id[requester.id].email == requester.email
    assert members_by_user_id[other_user.id].email == other_user.email

    assert members_by_user_id[requester.id].membership_id == (
        requester_membership.id
    )

    assert members_by_user_id[other_user.id].membership_id == (
        other_membership.id
    )


@pytest.mark.parametrize(
    "scenario, expected_status",
    [
        ("company_not_found", 404),
        ("company_inactive", 404),
        ("membership_not_found", 403),
        ("membership_inactive", 403),
        ("user_inactive", 403),
    ],
)
def test_list_company_members_rejects_unauthorized_access(
    db_session,
    scenario,
    expected_status,
):
    unique_id = uuid4().hex

    company = Company(
        name=f"Company {unique_id}",
        active=scenario != "company_inactive",
    )

    requester = User(
        email=f"requester-{unique_id}@example.com",
        company_name=company.name,
        password="test-password",
        active=scenario != "user_inactive",
    )

    db_session.add_all([company, requester])
    db_session.flush()

    if scenario != "membership_not_found":
        membership = CompanyMembership(
            company_id=company.id,
            user_id=requester.id,
            status=(
                CompanyMembershipStatus.INACTIVE
                if scenario == "membership_inactive"
                else CompanyMembershipStatus.ACTIVE
            ),
        )

        db_session.add(membership)
        db_session.flush()

    requested_company_id = (
        -1 if scenario == "company_not_found"
        else company.id
    )

    service = CompanyMembershipService()

    with pytest.raises(HTTPException) as exc_info:
        service.list_members(
            db=db_session,
            company_id=requested_company_id,
            current_user_id=requester.id,
        )

    assert exc_info.value.status_code == expected_status


def test_remove_company_member_success(db_session):
    unique_id = uuid4().hex

    company = Company(
        name=f"Company {unique_id}",
        active=True,
    )

    requester = User(
        name="Ana",
        email=f"requester-{unique_id}@example.com",
        company_name=company.name,
        password="test-password",
        active=True,
    )

    target_user = User(
        name="Carlos",
        email=f"member-{unique_id}@example.com",
        company_name=company.name,
        password="test-password",
        active=True,
    )

    db_session.add_all([company, requester, target_user])
    db_session.flush()

    requester_membership = CompanyMembership(
        company_id=company.id,
        user_id=requester.id,
        status=CompanyMembershipStatus.ACTIVE,
    )

    target_membership = CompanyMembership(
        company_id=company.id,
        user_id=target_user.id,
        status=CompanyMembershipStatus.ACTIVE,
    )

    db_session.add_all([
        requester_membership,
        target_membership,
    ])
    db_session.flush()

    service = CompanyMembershipService()

    result = service.remove_member(
        db=db_session,
        company_id=company.id,
        membership_id=target_membership.id,
        current_user_id=target_user.id,
    )

    assert result.id == target_membership.id
    assert result.status == CompanyMembershipStatus.INACTIVE

    db_session.expire_all()

    saved_membership = db_session.get(
        CompanyMembership,
        target_membership.id,
    )

    saved_user = db_session.get(
        User,
        target_user.id,
    )

    assert saved_membership is not None
    assert saved_membership.status == CompanyMembershipStatus.INACTIVE

    assert saved_user is not None
    assert saved_user.active is True

    remaining_active_members = (
        db_session.query(CompanyMembership)
        .filter(
            CompanyMembership.company_id == company.id,
            CompanyMembership.status
            == CompanyMembershipStatus.ACTIVE,
        )
        .count()
    )

    assert remaining_active_members == 1

def test_remove_last_active_company_member_is_rejected(db_session):
    unique_id = uuid4().hex

    company = Company(
        name=f"Company {unique_id}",
        active=True,
    )

    requester = User(
        name="Ana",
        email=f"requester-{unique_id}@example.com",
        company_name=company.name,
        password="test-password",
        active=True,
    )

    db_session.add_all([company, requester])
    db_session.flush()

    membership = CompanyMembership(
        company_id=company.id,
        user_id=requester.id,
        status=CompanyMembershipStatus.ACTIVE,
    )

    db_session.add(membership)
    db_session.flush()

    service = CompanyMembershipService()

    with pytest.raises(HTTPException) as exc_info:
        service.remove_member(
            db=db_session,
            company_id=company.id,
            membership_id=membership.id,
            current_user_id=requester.id,
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == (
        "Cannot remove the last active company member"
    )

    db_session.expire_all()

    saved_membership = db_session.get(
        CompanyMembership,
        membership.id,
    )

    assert saved_membership is not None
    assert saved_membership.status == CompanyMembershipStatus.ACTIVE


@pytest.mark.parametrize(
    "scenario, expected_status",
    [
        ("company_not_found", 404),
        ("company_inactive", 404),
        ("requester_not_member", 403),
        ("requester_membership_inactive", 403),
        ("requester_user_inactive", 403),
        ("target_not_found", 404),
        ("target_other_company", 404),
        ("target_already_inactive", 403),
    ],
)
def test_remove_company_member_rejects_invalid_operations(
    db_session,
    scenario,
    expected_status,
):
    unique_id = uuid4().hex

    company = Company(
        name=f"Company {unique_id}",
        active=scenario != "company_inactive",
    )

    other_company = Company(
        name=f"Other Company {unique_id}",
        active=True,
    )

    requester = User(
        email=f"requester-{unique_id}@example.com",
        company_name=company.name,
        password="test-password",
        active=scenario != "requester_user_inactive",
    )

    target_user = User(
        email=f"target-{unique_id}@example.com",
        company_name=company.name,
        password="test-password",
        active=True,
    )

    db_session.add_all([
        company,
        other_company,
        requester,
        target_user,
    ])
    db_session.flush()

    if scenario != "requester_not_member":
        requester_membership = CompanyMembership(
            company_id=company.id,
            user_id=requester.id,
            status=(
                CompanyMembershipStatus.INACTIVE
                if scenario == "requester_membership_inactive"
                else CompanyMembershipStatus.ACTIVE
            ),
        )
        db_session.add(requester_membership)

    target_membership = CompanyMembership(
        company_id=(
            other_company.id
            if scenario == "target_other_company"
            else company.id
        ),
        user_id=target_user.id,
        status=(
            CompanyMembershipStatus.INACTIVE
            if scenario == "target_already_inactive"
            else CompanyMembershipStatus.ACTIVE
        ),
    )

    db_session.add(target_membership)
    db_session.flush()

    requested_company_id = (
        -1 if scenario == "company_not_found"
        else company.id
    )

    requested_membership_id = (
        -1 if scenario == "target_not_found"
        else target_membership.id
    )

    service = CompanyMembershipService()

    with pytest.raises(HTTPException) as exc_info:
        service.remove_member(
            db=db_session,
            company_id=requested_company_id,
            membership_id=requested_membership_id,
            current_user_id=requester.id,
        )

    assert exc_info.value.status_code == expected_status

    db_session.expire_all()

    saved_target = db_session.get(
        CompanyMembership,
        target_membership.id,
    )

    assert saved_target is not None

    expected_target_status = (
        CompanyMembershipStatus.INACTIVE
        if scenario == "target_already_inactive"
        else CompanyMembershipStatus.ACTIVE
    )

    assert saved_target.status == expected_target_status


def test_remove_another_company_member_is_forbidden(db_session):
    unique_id = uuid4().hex

    company = Company(
        name=f"Company {unique_id}",
        active=True,
    )

    requester = User(
        name="Ana",
        email=f"requester-{unique_id}@example.com",
        company_name=company.name,
        password="test-password",
        active=True,
    )

    target_user = User(
        name="Carlos",
        email=f"target-{unique_id}@example.com",
        company_name=company.name,
        password="test-password",
        active=True,
    )

    db_session.add_all([company, requester, target_user])
    db_session.flush()

    requester_membership = CompanyMembership(
        company_id=company.id,
        user_id=requester.id,
        status=CompanyMembershipStatus.ACTIVE,
    )

    target_membership = CompanyMembership(
        company_id=company.id,
        user_id=target_user.id,
        status=CompanyMembershipStatus.ACTIVE,
    )

    db_session.add_all([
        requester_membership,
        target_membership,
    ])
    db_session.flush()

    target_membership_id = target_membership.id

    service = CompanyMembershipService()

    with pytest.raises(HTTPException) as exc_info:
        service.remove_member(
            db=db_session,
            company_id=company.id,
            membership_id=target_membership_id,
            current_user_id=requester.id,
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == (
        "Cannot remove another company member"
    )

    db_session.expire_all()

    saved_membership = db_session.get(
        CompanyMembership,
        target_membership_id,
    )

    assert saved_membership is not None
    assert saved_membership.status == CompanyMembershipStatus.ACTIVE
