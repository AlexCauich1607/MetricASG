from uuid import uuid4
from app.main import app
from app.services.token_service import get_current_user
from app.models.company_model import Company
from app.models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)
from app.models.user_model import User
from app.services.company_membership_service import (
    CompanyMembershipService,
)
from app.core.roles import CompanyRole
import pytest
from fastapi import HTTPException

@pytest.mark.parametrize(
    "member_role",
    [
        CompanyRole.COMPANY_ADMIN,
        CompanyRole.ASG_MANAGER,
        CompanyRole.COLLABORATOR,
        CompanyRole.AUDITOR,
    ],
)
def test_list_company_members_success(db_session, member_role):
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
        role=CompanyRole.COMPANY_ADMIN,
        status=CompanyMembershipStatus.ACTIVE,
    )

    other_membership = CompanyMembership(
        company_id=company.id,
        user_id=other_user.id,
        role=member_role,
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
    assert members_by_user_id[requester.id].role == (
        CompanyRole.COMPANY_ADMIN
    )

    assert members_by_user_id[other_user.id].role == member_role

    assert members_by_user_id[other_user.id].model_dump(
        mode="json"
    )["role"] == member_role.value


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
        "Insufficient company permissions"
    )

    db_session.expire_all()

    saved_membership = db_session.get(
        CompanyMembership,
        target_membership_id,
    )

    assert saved_membership is not None
    assert saved_membership.status == CompanyMembershipStatus.ACTIVE


@pytest.mark.parametrize(
    "role, expected_status",
    [
        (CompanyRole.COMPANY_ADMIN, 200),
        (CompanyRole.ASG_MANAGER, 200),
        (CompanyRole.COLLABORATOR, 200),
        (CompanyRole.AUDITOR, 403),
    ],
)
def test_list_company_members_enforces_company_roles(
    db_session,
    role,
    expected_status,
):
    unique_id = uuid4().hex

    company = Company(
        name=f"Role Test Company {unique_id}",
        active=True,
    )

    requester = User(
        name="Test",
        lastname="Member",
        email=f"role-member-{unique_id}@example.com",
        company_name=company.name,
        password="test-password",
        active=True,
    )

    db_session.add_all([company, requester])
    db_session.flush()

    membership = CompanyMembership(
        company_id=company.id,
        user_id=requester.id,
        role=role,
        status=CompanyMembershipStatus.ACTIVE,
    )

    db_session.add(membership)
    db_session.flush()

    service = CompanyMembershipService()

    if expected_status == 403:
        with pytest.raises(HTTPException) as exc:
            service.list_members(
                db=db_session,
                company_id=company.id,
                current_user_id=requester.id,
            )

        assert exc.value.status_code == 403
        assert exc.value.detail == (
            "Insufficient company permissions"
        )
    else:
        members = service.list_members(
            db=db_session,
            company_id=company.id,
            current_user_id=requester.id,
        )

        assert len(members) == 1
        assert members[0].user_id == requester.id


def create_membership_role_scenario(
    db_session,
    requester_role=CompanyRole.COMPANY_ADMIN,
    target_role=CompanyRole.COLLABORATOR,
):
    unique_id = uuid4().hex

    company = Company(
        name=f"Removal Company {unique_id}",
        active=True,
    )

    requester = User(
        name="Requester",
        lastname="Test",
        email=f"removal-requester-{unique_id}@example.com",
        company_name=company.name,
        password="test-password",
        active=True,
    )

    target = User(
        name="Target",
        lastname="Test",
        email=f"removal-target-{unique_id}@example.com",
        company_name=company.name,
        password="test-password",
        active=True,
    )

    db_session.add_all([company, requester, target])
    db_session.flush()

    requester_membership = CompanyMembership(
        company_id=company.id,
        user_id=requester.id,
        role=requester_role,
        status=CompanyMembershipStatus.ACTIVE,
    )

    target_membership = CompanyMembership(
        company_id=company.id,
        user_id=target.id,
        role=target_role,
        status=CompanyMembershipStatus.ACTIVE,
    )

    db_session.add_all([
        requester_membership,
        target_membership,
    ])
    db_session.flush()

    return (
        company,
        requester,
        requester_membership,
        target_membership,
    )


def test_company_admin_can_remove_another_member(db_session):
    company, requester, _, target = (
        create_membership_role_scenario(db_session)
    )

    removed = CompanyMembershipService().remove_member(
        db=db_session,
        company_id=company.id,
        membership_id=target.id,
        current_user_id=requester.id,
    )

    assert removed.id == target.id
    assert removed.status == CompanyMembershipStatus.INACTIVE


@pytest.mark.parametrize(
    "role",
    [
        CompanyRole.ASG_MANAGER,
        CompanyRole.COLLABORATOR,
        CompanyRole.AUDITOR,
    ],
)
def test_non_admin_cannot_remove_another_member(
    db_session,
    role,
):
    company, requester, _, target = (
        create_membership_role_scenario(
            db_session,
            requester_role=role,
        )
    )

    with pytest.raises(HTTPException) as exc:
        CompanyMembershipService().remove_member(
            db=db_session,
            company_id=company.id,
            membership_id=target.id,
            current_user_id=requester.id,
        )

    assert exc.value.status_code == 403
    assert target.status == CompanyMembershipStatus.ACTIVE


@pytest.mark.parametrize(
    "role",
    [
        CompanyRole.ASG_MANAGER,
        CompanyRole.COLLABORATOR,
        CompanyRole.AUDITOR,
    ],
)
def test_member_can_leave_company(
    db_session,
    role,
):
    company, requester, membership, _ = (
        create_membership_role_scenario(
            db_session,
            requester_role=role,
            target_role=CompanyRole.COMPANY_ADMIN,
        )
    )

    removed = CompanyMembershipService().remove_member(
        db=db_session,
        company_id=company.id,
        membership_id=membership.id,
        current_user_id=requester.id,
    )

    assert removed.status == CompanyMembershipStatus.INACTIVE


def test_last_company_admin_cannot_leave(db_session):
    company, requester, membership, _ = (
        create_membership_role_scenario(db_session)
    )

    with pytest.raises(HTTPException) as exc:
        CompanyMembershipService().remove_member(
            db=db_session,
            company_id=company.id,
            membership_id=membership.id,
            current_user_id=requester.id,
        )

    assert exc.value.status_code == 409
    assert exc.value.detail == (
        "Cannot remove the last active company administrator"
    )


def test_inactive_company_admin_cannot_remove_another_admin(db_session):
    company, requester, _, target = (
        create_membership_role_scenario(
            db_session,
            requester_role=CompanyRole.COMPANY_ADMIN,
            target_role=CompanyRole.COMPANY_ADMIN,
        )
    )

    # Desactivar la membresía del solicitante deja
    # al objetivo como único administrador activo.
    requester_membership = (
        db_session.query(CompanyMembership)
        .filter(
            CompanyMembership.user_id == requester.id,
            CompanyMembership.company_id == company.id,
        )
        .one()
    )

    requester_membership.status = CompanyMembershipStatus.INACTIVE
    db_session.flush()

    with pytest.raises(HTTPException) as exc:
        CompanyMembershipService().remove_member(
            db=db_session,
            company_id=company.id,
            membership_id=target.id,
            current_user_id=requester.id,
        )

    assert exc.value.status_code == 403


def test_company_admin_can_remove_admin_when_another_remains(
    db_session,
):
    company, requester, _, target = (
        create_membership_role_scenario(
            db_session,
            requester_role=CompanyRole.COMPANY_ADMIN,
            target_role=CompanyRole.COMPANY_ADMIN,
        )
    )

    removed = CompanyMembershipService().remove_member(
        db=db_session,
        company_id=company.id,
        membership_id=target.id,
        current_user_id=requester.id,
    )

    assert removed.status == CompanyMembershipStatus.INACTIVE


@pytest.mark.parametrize(
    "scenario, expected_company",
    [
        ("active_membership", True),
        ("inactive_membership", False),
        ("inactive_company", False),
        ("another_user", False),
    ],
)
def test_list_user_memberships_filters_access(
    db_session,
    scenario,
    expected_company,
):
    unique_id = uuid4().hex

    company = Company(
        name=f"Membership Company {unique_id}",
        active=scenario != "inactive_company",
    )

    current_user = User(
        name="Ana",
        lastname="López",
        email=f"current-{unique_id}@example.com",
        company_name=company.name,
        password="test-password",
        active=True,
    )

    other_user = User(
        name="Carlos",
        lastname="Pérez",
        email=f"other-{unique_id}@example.com",
        company_name=company.name,
        password="test-password",
        active=True,
    )

    db_session.add_all([company, current_user, other_user])
    db_session.flush()

    membership = CompanyMembership(
        company_id=company.id,
        user_id=(
            other_user.id
            if scenario == "another_user"
            else current_user.id
        ),
        role=CompanyRole.ASG_MANAGER,
        status=(
            CompanyMembershipStatus.INACTIVE
            if scenario == "inactive_membership"
            else CompanyMembershipStatus.ACTIVE
        ),
    )

    db_session.add(membership)
    db_session.flush()

    memberships = CompanyMembershipService().list_user_memberships(
        db=db_session,
        current_user_id=current_user.id,
    )

    if expected_company:
        assert len(memberships) == 1

        result = memberships[0]

        assert result.membership_id == membership.id
        assert result.company_id == company.id
        assert result.company_name == company.name
        assert result.role == CompanyRole.ASG_MANAGER

    else:
        assert memberships == []


def test_list_my_company_memberships_http(client, db_session):
    unique_id = uuid4().hex

    company = Company(
        name=f"HTTP Membership Company {unique_id}",
        active=True,
    )

    user = User(
        name="Ana",
        lastname="López",
        email=f"http-member-{unique_id}@example.com",
        company_name=company.name,
        password="test-password",
        active=True,
    )

    db_session.add_all([company, user])
    db_session.flush()

    membership = CompanyMembership(
        company_id=company.id,
        user_id=user.id,
        role=CompanyRole.ASG_MANAGER,
        status=CompanyMembershipStatus.ACTIVE,
    )

    db_session.add(membership)
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: user

    response = client.get(
        "/api/companies/me/memberships"
    )

    assert response.status_code == 200, response.text

    body = response.json()

    assert len(body) == 1

    assert body[0]["membership_id"] == membership.id
    assert body[0]["company_id"] == company.id
    assert body[0]["company_name"] == company.name
    assert body[0]["role"] == CompanyRole.ASG_MANAGER.value
    assert body[0]["joined_at"] is not None
