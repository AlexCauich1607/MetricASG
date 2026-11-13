from datetime import date, timedelta

import pytest

from app.core.roles import CompanyRole
from app.models.company_membership_model import (
    CompanyMembershipStatus,
)
from app.models.improvement_action_model import (
    ImprovementAction,
    ImprovementStatus,
)
from app.models.notification_model import (
    Notification,
    NotificationChannel,
    NotificationStatus,
)
from app.services.improvement_action_notification_service import (
    ImprovementActionNotificationService,
)
from tests.test_evaluation_evidence import create_evidence_data


TODAY = date(2026, 11, 13)


@pytest.fixture
def improvement_notification_data(db_session):
    data = create_evidence_data(db_session)

    user = data["user"]
    membership = data["membership"]

    user.active = True
    membership.status = CompanyMembershipStatus.ACTIVE
    membership.role = CompanyRole.ASG_MANAGER

    action = ImprovementAction(
        evaluation_id=data["evaluation"].id,
        gap_description="Consumo elevado de energía",
        description="Implementar iluminación LED",
        responsible="Departamento de operaciones",
        target_date=TODAY + timedelta(days=7),
        status=ImprovementStatus.PENDING,
    )

    db_session.add(action)
    db_session.flush()

    return {
        "action": action,
        "user": user,
        "company_id": data["evaluation"].company_id,
    }


@pytest.mark.parametrize(
    "days_until,expected_event",
    [
        (7, "IMPROVEMENT_ACTION_DUE"),
        (0, "IMPROVEMENT_ACTION_DUE"),
        (-1, "IMPROVEMENT_ACTION_OVERDUE"),
    ],
)
def test_generates_improvement_action_notifications(
    db_session,
    improvement_notification_data,
    days_until,
    expected_event,
):
    action = improvement_notification_data["action"]
    user = improvement_notification_data["user"]

    action.target_date = TODAY + timedelta(days=days_until)
    db_session.flush()

    created = ImprovementActionNotificationService(
        db_session
    ).generate(today=TODAY)

    notifications = (
        db_session.query(Notification)
        .filter(
            Notification.resource_type == "improvement_action",
            Notification.resource_id == action.id,
        )
        .all()
    )

    assert created == 1
    assert len(notifications) == 1

    notification = notifications[0]

    assert notification.user_id == user.id
    assert notification.company_id == (
        improvement_notification_data["company_id"]
    )
    assert notification.event_type == expected_event
    assert notification.channel == NotificationChannel.IN_APP
    assert notification.status == NotificationStatus.PENDING

    assert action.target_date.isoformat() in notification.message

    assert notification.deduplication_key == (
        f"improvement_action:{action.id}:"
        f"{expected_event}:"
        f"{action.target_date.isoformat()}"
    )

    assert notification.read_at is None


@pytest.mark.parametrize(
    "action_status,days_until,expected_created",
    [
        (ImprovementStatus.COMPLETED, 3, 0),
        (ImprovementStatus.CANCELLED, 3, 0),
        (ImprovementStatus.PENDING, 8, 0),
        (ImprovementStatus.IN_PROGRESS, 3, 1),
    ],
)
def test_improvement_notification_eligibility(
    db_session,
    improvement_notification_data,
    action_status,
    days_until,
    expected_created,
):
    action = improvement_notification_data["action"]

    action.status = action_status
    action.target_date = TODAY + timedelta(days=days_until)

    db_session.flush()

    created = ImprovementActionNotificationService(
        db_session
    ).generate(today=TODAY)

    notifications = (
        db_session.query(Notification)
        .filter(
            Notification.resource_type == "improvement_action",
            Notification.resource_id == action.id,
        )
        .all()
    )

    assert created == expected_created
    assert len(notifications) == expected_created

    if expected_created:
        assert notifications[0].event_type == (
            "IMPROVEMENT_ACTION_DUE"
        )
        assert notifications[0].status == NotificationStatus.PENDING


@pytest.mark.parametrize(
    "role,membership_active,user_active,expected_created",
    [
        (CompanyRole.COMPANY_ADMIN, True, True, 1),
        (CompanyRole.ASG_MANAGER, True, True, 1),
        (CompanyRole.COLLABORATOR, True, True, 0),
        (CompanyRole.AUDITOR, True, True, 0),
        (CompanyRole.COMPANY_ADMIN, False, True, 0),
        (CompanyRole.COMPANY_ADMIN, True, False, 0),
    ],
)
def test_improvement_notification_recipient_eligibility(
    db_session,
    improvement_notification_data,
    role,
    membership_active,
    user_active,
    expected_created,
):
    action = improvement_notification_data["action"]
    user = improvement_notification_data["user"]

    from app.models.company_membership_model import CompanyMembership

    membership = (
        db_session.query(CompanyMembership)
        .filter(
            CompanyMembership.user_id == user.id,
            CompanyMembership.company_id
            == improvement_notification_data["company_id"],
        )
        .one()
    )

    membership.role = role
    membership.status = (
        CompanyMembershipStatus.ACTIVE
        if membership_active
        else CompanyMembershipStatus.INACTIVE
    )

    user.active = user_active
    db_session.flush()

    created = ImprovementActionNotificationService(
        db_session
    ).generate(today=TODAY)

    notifications = (
        db_session.query(Notification)
        .filter(
            Notification.resource_type == "improvement_action",
            Notification.resource_id == action.id,
        )
        .all()
    )

    assert created == expected_created
    assert len(notifications) == expected_created

    if expected_created:
        assert notifications[0].user_id == user.id
        assert notifications[0].company_id == (
            improvement_notification_data["company_id"]
        )


def test_improvement_notification_isolated_between_companies(
    db_session,
    improvement_notification_data,
):
    import uuid

    from app.core.roles import UserRole
    from app.models.company_model import Company
    from app.models.company_membership_model import CompanyMembership
    from app.models.user_model import User

    action = improvement_notification_data["action"]
    authorized_user = improvement_notification_data["user"]
    company_id = improvement_notification_data["company_id"]

    unique_id = uuid.uuid4().hex

    other_company = Company(
        name=f"Other Notification Company {unique_id}",
        active=True,
    )

    other_user = User(
        name="Other",
        lastname="Administrator",
        company_name=other_company.name,
        email=f"other-admin-{unique_id}@test.local",
        password="test-password",
        role=UserRole.USER,
        active=True,
    )

    db_session.add_all([other_company, other_user])
    db_session.flush()

    other_membership = CompanyMembership(
        company_id=other_company.id,
        user_id=other_user.id,
        role=CompanyRole.COMPANY_ADMIN,
        status=CompanyMembershipStatus.ACTIVE,
    )

    db_session.add(other_membership)
    db_session.flush()

    created = ImprovementActionNotificationService(
        db_session
    ).generate(today=TODAY)

    notifications = (
        db_session.query(Notification)
        .filter(
            Notification.resource_type == "improvement_action",
            Notification.resource_id == action.id,
        )
        .all()
    )

    assert created == 1
    assert len(notifications) == 1

    notification = notifications[0]

    assert notification.user_id == authorized_user.id
    assert notification.company_id == company_id

    assert notification.user_id != other_user.id
    assert notification.company_id != other_company.id

    assert (
        db_session.query(Notification)
        .filter(
            Notification.user_id == other_user.id,
            Notification.resource_type == "improvement_action",
            Notification.resource_id == action.id,
        )
        .count()
    ) == 0


from app.models.notification_preference_model import (
    NotificationPreference,
)
from app.models.notification_event_preference_model import (
    NotificationEventPreference,
)


@pytest.mark.parametrize(
    "preference_scope,days_until,event_type",
    [
        ("global", 3, "IMPROVEMENT_ACTION_DUE"),
        ("event", 3, "IMPROVEMENT_ACTION_DUE"),
        ("event", -1, "IMPROVEMENT_ACTION_OVERDUE"),
    ],
)
def test_improvement_notifications_respect_preferences(
    db_session,
    improvement_notification_data,
    preference_scope,
    days_until,
    event_type,
):
    action = improvement_notification_data["action"]
    user = improvement_notification_data["user"]

    action.target_date = TODAY + timedelta(days=days_until)

    if preference_scope == "global":
        preference = NotificationPreference(
            user_id=user.id,
            in_app_enabled=False,
            email_enabled=True,
        )
    else:
        preference = NotificationEventPreference(
            user_id=user.id,
            event_type=event_type,
            in_app_enabled=False,
            email_enabled=True,
        )

    db_session.add(preference)
    db_session.flush()

    created = ImprovementActionNotificationService(
        db_session
    ).generate(today=TODAY)

    assert created == 0

    assert (
        db_session.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.resource_type == "improvement_action",
            Notification.resource_id == action.id,
        )
        .count()
    ) == 0


def test_improvement_notifications_are_idempotent(
    db_session,
    improvement_notification_data,
):
    action = improvement_notification_data["action"]
    user = improvement_notification_data["user"]

    service = ImprovementActionNotificationService(db_session)

    first_execution = service.generate(today=TODAY)
    second_execution = service.generate(today=TODAY)

    notifications = (
        db_session.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.resource_type == "improvement_action",
            Notification.resource_id == action.id,
        )
        .all()
    )

    assert first_execution == 1
    assert second_execution == 0

    assert len(notifications) == 1
    assert notifications[0].event_type == "IMPROVEMENT_ACTION_DUE"


@pytest.mark.parametrize(
    "change,expected_cancelled",
    [
        ("unchanged", 0),
        ("completed", 1),
        ("cancelled", 1),
        ("target_date_changed", 1),
        ("became_overdue", 1),
        ("global_preference_disabled", 1),
    ],
)
def test_cancel_obsolete_improvement_notifications(
    db_session,
    improvement_notification_data,
    change,
    expected_cancelled,
):
    action = improvement_notification_data["action"]
    user = improvement_notification_data["user"]

    service = ImprovementActionNotificationService(db_session)

    assert service.generate(today=TODAY) == 1

    notification = (
        db_session.query(Notification)
        .filter(
            Notification.resource_type == "improvement_action",
            Notification.resource_id == action.id,
        )
        .one()
    )

    assert notification.status == NotificationStatus.PENDING

    if change == "completed":
        action.status = ImprovementStatus.COMPLETED

    elif change == "cancelled":
        action.status = ImprovementStatus.CANCELLED

    elif change == "target_date_changed":
        action.target_date = TODAY + timedelta(days=5)

    elif change == "became_overdue":
        action.target_date = TODAY - timedelta(days=1)

    elif change == "global_preference_disabled":
        db_session.add(
            NotificationPreference(
                user_id=user.id,
                in_app_enabled=False,
                email_enabled=True,
            )
        )

    db_session.flush()

    cancelled = service.cancel_obsolete(today=TODAY)

    assert cancelled == expected_cancelled

    expected_status = (
        NotificationStatus.CANCELLED
        if expected_cancelled
        else NotificationStatus.PENDING
    )

    assert notification.status == expected_status

    # El registro se conserva para mantener su historial.
    assert (
        db_session.query(Notification)
        .filter(Notification.id == notification.id)
        .count()
    ) == 1


@pytest.mark.parametrize(
    "change,expected_new_event",
    [
        ("target_date_changed", "IMPROVEMENT_ACTION_DUE"),
        ("became_overdue", "IMPROVEMENT_ACTION_OVERDUE"),
        ("completed", None),
        ("cancelled", None),
    ],
)
def test_generate_synchronizes_obsolete_notifications(
    db_session,
    improvement_notification_data,
    change,
    expected_new_event,
):
    action = improvement_notification_data["action"]
    user = improvement_notification_data["user"]

    service = ImprovementActionNotificationService(db_session)

    assert service.generate(today=TODAY) == 1

    previous_notification = (
        db_session.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.resource_type == "improvement_action",
            Notification.resource_id == action.id,
        )
        .one()
    )

    previous_notification_id = previous_notification.id

    assert previous_notification.event_type == (
        "IMPROVEMENT_ACTION_DUE"
    )
    assert previous_notification.status == NotificationStatus.PENDING

    if change == "target_date_changed":
        action.target_date = TODAY + timedelta(days=5)

    elif change == "became_overdue":
        action.target_date = TODAY - timedelta(days=1)

    elif change == "completed":
        action.status = ImprovementStatus.COMPLETED

    elif change == "cancelled":
        action.status = ImprovementStatus.CANCELLED

    db_session.flush()

    created = service.generate(today=TODAY)

    notifications = (
        db_session.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.resource_type == "improvement_action",
            Notification.resource_id == action.id,
        )
        .order_by(Notification.id.asc())
        .all()
    )

    old_notification = next(
        item
        for item in notifications
        if item.id == previous_notification_id
    )

    assert old_notification.status == NotificationStatus.CANCELLED

    if expected_new_event is None:
        assert created == 0
        assert len(notifications) == 1

    else:
        assert created == 1
        assert len(notifications) == 2

        new_notification = next(
            item
            for item in notifications
            if item.id != previous_notification_id
        )

        assert new_notification.event_type == expected_new_event
        assert new_notification.status == NotificationStatus.PENDING

        assert new_notification.deduplication_key == (
            f"improvement_action:{action.id}:"
            f"{expected_new_event}:"
            f"{action.target_date.isoformat()}"
        )

    # Una tercera ejecución no debe generar duplicados.
    assert service.generate(today=TODAY) == 0


@pytest.mark.parametrize(
    "scenario",
    [
        "restored_target_date",
        "reopened_action",
    ],
)
def test_reactivates_cancelled_improvement_notification(
    db_session,
    improvement_notification_data,
    scenario,
):
    action = improvement_notification_data["action"]
    user = improvement_notification_data["user"]

    service = ImprovementActionNotificationService(db_session)

    # Primera generación.
    assert service.generate(today=TODAY) == 1

    original = (
        db_session.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.resource_type == "improvement_action",
            Notification.resource_id == action.id,
        )
        .one()
    )

    original_id = original.id
    original_date = action.target_date

    # Provocar la cancelación.
    if scenario == "restored_target_date":
        action.target_date = TODAY + timedelta(days=5)
    else:
        action.status = ImprovementStatus.COMPLETED

    db_session.flush()
    service.generate(today=TODAY)

    assert original.status == NotificationStatus.CANCELLED

    # Recuperar la condición original.
    if scenario == "restored_target_date":
        action.target_date = original_date
    else:
        action.status = ImprovementStatus.IN_PROGRESS

    db_session.flush()

    # No debe insertarse un duplicado.
    assert service.generate(today=TODAY) == 0

    notifications = (
        db_session.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.resource_type == "improvement_action",
            Notification.resource_id == action.id,
        )
        .all()
    )

    restored = next(
        notification
        for notification in notifications
        if notification.id == original_id
    )

    assert restored.status == NotificationStatus.PENDING

    expected_count = (
        2 if scenario == "restored_target_date" else 1
    )
    assert len(notifications) == expected_count

    assert service.generate(today=TODAY) == 0


@pytest.mark.parametrize(
    "change",
    [
        "role_revoked",
        "membership_inactive",
        "event_preference_disabled",
    ],
)
def test_generate_cancels_notification_when_recipient_loses_eligibility(
    db_session,
    improvement_notification_data,
    change,
):
    from app.models.company_membership_model import CompanyMembership

    action = improvement_notification_data["action"]
    user = improvement_notification_data["user"]

    service = ImprovementActionNotificationService(db_session)

    assert service.generate(today=TODAY) == 1

    notification = (
        db_session.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.resource_type == "improvement_action",
            Notification.resource_id == action.id,
        )
        .one()
    )

    membership = (
        db_session.query(CompanyMembership)
        .filter(
            CompanyMembership.user_id == user.id,
            CompanyMembership.company_id
            == improvement_notification_data["company_id"],
        )
        .one()
    )

    if change == "role_revoked":
        membership.role = CompanyRole.COLLABORATOR

    elif change == "membership_inactive":
        membership.status = CompanyMembershipStatus.INACTIVE

    elif change == "event_preference_disabled":
        db_session.add(
            NotificationEventPreference(
                user_id=user.id,
                event_type="IMPROVEMENT_ACTION_DUE",
                in_app_enabled=False,
                email_enabled=True,
            )
        )

    db_session.flush()

    assert service.generate(today=TODAY) == 0
    assert notification.status == NotificationStatus.CANCELLED

    # No se elimina el registro histórico.
    assert db_session.get(Notification, notification.id) is not None


def test_generate_reactivates_after_event_preference_restored(
    db_session,
    improvement_notification_data,
):
    action = improvement_notification_data["action"]
    user = improvement_notification_data["user"]

    service = ImprovementActionNotificationService(db_session)

    assert service.generate(today=TODAY) == 1

    notification = (
        db_session.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.resource_type == "improvement_action",
            Notification.resource_id == action.id,
        )
        .one()
    )

    original_id = notification.id

    preference = NotificationEventPreference(
        user_id=user.id,
        event_type="IMPROVEMENT_ACTION_DUE",
        in_app_enabled=False,
        email_enabled=True,
    )

    db_session.add(preference)
    db_session.flush()

    assert service.generate(today=TODAY) == 0
    assert notification.status == NotificationStatus.CANCELLED

    preference.in_app_enabled = True
    db_session.flush()

    assert service.generate(today=TODAY) == 0

    assert notification.id == original_id
    assert notification.status == NotificationStatus.PENDING

    assert (
        db_session.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.resource_type == "improvement_action",
            Notification.resource_id == action.id,
        )
        .count()
    ) == 1


def test_reactivated_notification_preserves_read_history(
    db_session,
    improvement_notification_data,
):
    from datetime import datetime, timezone

    action = improvement_notification_data["action"]
    user = improvement_notification_data["user"]

    service = ImprovementActionNotificationService(db_session)

    assert service.generate(today=TODAY) == 1

    notification = (
        db_session.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.resource_type == "improvement_action",
            Notification.resource_id == action.id,
        )
        .one()
    )

    original_id = notification.id
    read_at = datetime(2026, 11, 13, 12, 0, tzinfo=timezone.utc)

    notification.read_at = read_at
    db_session.flush()

    action.status = ImprovementStatus.COMPLETED
    db_session.flush()

    assert service.generate(today=TODAY) == 0
    assert notification.status == NotificationStatus.CANCELLED
    assert notification.read_at == read_at

    action.status = ImprovementStatus.IN_PROGRESS
    db_session.flush()

    assert service.generate(today=TODAY) == 0

    assert notification.id == original_id
    assert notification.status == NotificationStatus.PENDING
    assert notification.read_at == read_at

    unread_count = (
        db_session.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.channel == NotificationChannel.IN_APP,
            Notification.status.in_(
                [
                    NotificationStatus.PENDING,
                    NotificationStatus.SENT,
                ]
            ),
            Notification.read_at.is_(None),
        )
        .count()
    )

    assert unread_count == 0
