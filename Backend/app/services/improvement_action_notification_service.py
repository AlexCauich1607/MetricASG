from datetime import date

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.roles import CompanyRole
from app.models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)
from app.models.evaluation_model import Evaluation
from app.models.improvement_action_model import (
    ImprovementAction,
    ImprovementStatus,
)
from app.models.notification_event_preference_request import (
    NotificationEventType,
)
from app.models.notification_model import (
    Notification,
    NotificationChannel,
    NotificationStatus,
)
from app.services.notification_preference_service import (
    NotificationPreferenceService,
)
from app.models.user_model import User
from app.services.notification_service import NotificationService


class ImprovementActionNotificationService:

    ADVISORY_LOCK_ID = 420042

    DUE_WINDOW_DAYS = 7

    ACTIVE_STATUSES = (
        ImprovementStatus.PENDING,
        ImprovementStatus.IN_PROGRESS,
    )

    RECIPIENT_ROLES = (
        CompanyRole.COMPANY_ADMIN,
        CompanyRole.ASG_MANAGER,
    )

    def __init__(self, db: Session):
        self.db = db
        self.notification_service = NotificationService(db)


    def _reactivate_cancelled(
        self,
        *,
        user_id: int,
        company_id: int,
        action_id: int,
        event_type: str,
        deduplication_key: str,
    ) -> bool:
        preference_service = NotificationPreferenceService(self.db)

        if not preference_service.is_enabled(
            user_id=user_id,
            event_type=event_type,
            channel=NotificationChannel.IN_APP,
        ):
            return False

        notification = (
            self.db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.company_id == company_id,
                Notification.resource_type == "improvement_action",
                Notification.resource_id == action_id,
                Notification.event_type == event_type,
                Notification.channel == NotificationChannel.IN_APP,
                Notification.deduplication_key == deduplication_key,
                Notification.status == NotificationStatus.CANCELLED,
            )
            .with_for_update()
            .first()
        )

        if notification is None:
            return False

        notification.status = NotificationStatus.PENDING
        return True

    def cancel_obsolete(self, today: date | None = None) -> int:
        today = today or date.today()

        event_types = (
            NotificationEventType.IMPROVEMENT_ACTION_DUE.value,
            NotificationEventType.IMPROVEMENT_ACTION_OVERDUE.value,
        )

        notifications = (
            self.db.query(Notification)
            .filter(
                Notification.resource_type == "improvement_action",
                Notification.channel == NotificationChannel.IN_APP,
                Notification.event_type.in_(event_types),
                Notification.status.in_(
                    (
                        NotificationStatus.PENDING,
                        NotificationStatus.SENT,
                    )
                ),
            )
            .all()
        )

        preference_service = NotificationPreferenceService(self.db)
        cancelled = 0

        for notification in notifications:
            action = self.db.get(
                ImprovementAction,
                notification.resource_id,
            ) if notification.resource_id is not None else None

            valid = False

            if (
                action is not None
                and action.status in self.ACTIVE_STATUSES
                and action.target_date is not None
            ):
                evaluation = self.db.get(
                    Evaluation,
                    action.evaluation_id,
                )

                days_until = (action.target_date - today).days

                if days_until < 0:
                    expected_event = (
                        NotificationEventType
                        .IMPROVEMENT_ACTION_OVERDUE.value
                    )
                elif days_until <= self.DUE_WINDOW_DAYS:
                    expected_event = (
                        NotificationEventType
                        .IMPROVEMENT_ACTION_DUE.value
                    )
                else:
                    expected_event = None

                expected_key = (
                    f"improvement_action:{action.id}:"
                    f"{expected_event}:"
                    f"{action.target_date.isoformat()}"
                ) if expected_event is not None else None

                user = self.db.get(User, notification.user_id)

                membership = None

                if evaluation is not None and user is not None:
                    membership = (
                        self.db.query(CompanyMembership.id)
                        .filter(
                            CompanyMembership.user_id == user.id,
                            CompanyMembership.company_id
                            == evaluation.company_id,
                            CompanyMembership.status
                            == CompanyMembershipStatus.ACTIVE,
                            CompanyMembership.role.in_(
                                self.RECIPIENT_ROLES
                            ),
                        )
                        .first()
                    )

                if (
                    evaluation is not None
                    and user is not None
                    and user.active
                    and membership is not None
                    and notification.company_id
                    == evaluation.company_id
                    and notification.event_type == expected_event
                    and notification.deduplication_key == expected_key
                ):
                    valid = preference_service.is_enabled(
                        user_id=user.id,
                        event_type=notification.event_type,
                        channel=NotificationChannel.IN_APP,
                    )

            if not valid:
                notification.status = NotificationStatus.CANCELLED
                cancelled += 1

        return cancelled

    def generate(self, today: date | None = None) -> int:
        today = today or date.today()

        acquired = self.db.execute(
            text("SELECT pg_try_advisory_xact_lock(:lock_id)"),
            {"lock_id": self.ADVISORY_LOCK_ID},
        ).scalar_one()

        if not acquired:
            self.db.rollback()
            return 0

        actions = (
            self.db.query(
                ImprovementAction,
                Evaluation.company_id,
            )
            .join(
                Evaluation,
                ImprovementAction.evaluation_id == Evaluation.id,
            )
            .filter(
                ImprovementAction.status.in_(
                    self.ACTIVE_STATUSES
                ),
                ImprovementAction.target_date.isnot(None),
            )
            .all()
        )

        created = 0

        try:
            self.cancel_obsolete(today=today)

            for action, company_id in actions:
                days_until = (
                    action.target_date - today
                ).days

                if days_until > self.DUE_WINDOW_DAYS:
                    continue

                if days_until < 0:
                    event_type = (
                        NotificationEventType
                        .IMPROVEMENT_ACTION_OVERDUE.value
                    )
                    title = "Acción de mejora vencida"
                    message = (
                        "Una acción de mejora tiene una fecha "
                        "objetivo vencida: "
                        f"{action.target_date.isoformat()}."
                    )
                else:
                    event_type = (
                        NotificationEventType
                        .IMPROVEMENT_ACTION_DUE.value
                    )
                    title = "Acción de mejora próxima a vencer"
                    message = (
                        "Una acción de mejora tiene como fecha "
                        "objetivo el "
                        f"{action.target_date.isoformat()}."
                    )

                recipients = (
                    self.db.query(User.id)
                    .join(
                        CompanyMembership,
                        CompanyMembership.user_id == User.id,
                    )
                    .filter(
                        CompanyMembership.company_id == company_id,
                        CompanyMembership.status
                        == CompanyMembershipStatus.ACTIVE,
                        CompanyMembership.role.in_(
                            self.RECIPIENT_ROLES
                        ),
                        User.active.is_(True),
                    )
                    .all()
                )

                deduplication_key = (
                    f"improvement_action:{action.id}:"
                    f"{event_type}:"
                    f"{action.target_date.isoformat()}"
                )

                for (user_id,) in recipients:
                    if self._reactivate_cancelled(
                        user_id=user_id,
                        company_id=company_id,
                        action_id=action.id,
                        event_type=event_type,
                        deduplication_key=deduplication_key,
                    ):
                        continue

                    if self.notification_service.create(
                        user_id=user_id,
                        company_id=company_id,
                        event_type=event_type,
                        channel=NotificationChannel.IN_APP,
                        title=title,
                        message=message,
                        deduplication_key=deduplication_key,
                        resource_type="improvement_action",
                        resource_id=action.id,
                    ):
                        created += 1

            self.db.commit()

        except Exception:
            self.db.rollback()
            raise

        return created
