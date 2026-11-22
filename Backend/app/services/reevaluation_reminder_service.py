
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from app.core.config import settings
from sqlalchemy import exists
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session
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
from app.services.notification_service import NotificationService

from app.models.evaluation_model import (
    Evaluation,
    EvaluationStatus,
)
from app.models.notification_preference_model import (
    NotificationPreference,
)
from app.models.reevaluation_reminder_model import (
    ReevaluationReminder,
    ReminderChannel,
    ReminderStatus,
    ReminderType,
)
from app.models.user_model import User
from app.models.company_model import Company

from app.models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)

class ReevaluationReminderService:

    REMINDER_SCHEDULE = {
        ReminderType.FIRST: 30,
        ReminderType.SECOND: 7,
        ReminderType.DUE: 0,
    }

    def __init__(
        self,
        db: Session,
        timezone: str | None = None,
    ):
        self.db = db
        self.timezone = ZoneInfo(
            timezone if timezone is not None
            else settings.reminder_timezone
        )

    def generate(self, today=None) -> int:
        if today is None:
            today = datetime.now(self.timezone).date()

        reminder_dates = {
            today + timedelta(days=days): reminder_type
            for reminder_type, days in self.REMINDER_SCHEDULE.items()
        }

        companies = (
            self.db.query(Company)
            .filter(
                Company.active.is_(True),
                Company.next_evaluation.isnot(None),
                exists().where(
                    Evaluation.company_id == Company.id,
                    Evaluation.status == EvaluationStatus.COMPLETED,
                ),
            )
            .all()
        )

        preference_service = NotificationPreferenceService(self.db)
        notification_service = NotificationService(self.db)

        created = 0

        try:
            for company in companies:
                target_date = company.next_evaluation.date()
                reminder_type = reminder_dates.get(target_date)

                if reminder_type is None:
                    continue

                # Enviar recordatorios únicamente a integrantes activos.
                memberships = (
                    self.db.query(CompanyMembership)
                    .join(
                        User,
                        User.id == CompanyMembership.user_id,
                    )
                    .filter(
                        CompanyMembership.company_id == company.id,
                        CompanyMembership.status
                        == CompanyMembershipStatus.ACTIVE,
                        User.active.is_(True),
                    )
                    .all()
                )

                for membership in memberships:
                    user = membership.user

                    for channel in ReminderChannel:
                        notification_channel = NotificationChannel(
                            channel.value
                        )

                        if not preference_service.is_enabled(
                            user_id=user.id,
                            event_type=(
                                NotificationEventType
                                .REEVALUATION_REMINDER.value
                            ),
                            channel=notification_channel,
                        ):
                            continue

                        statement = (
                            insert(ReevaluationReminder)
                            .values(
                                user_id=user.id,
                                company_id=company.id,
                                target_date=target_date,
                                reminder_type=reminder_type,
                                channel=channel,
                                status=ReminderStatus.PENDING,
                            )
                            .on_conflict_do_nothing(
                                constraint=(
                                    "uq_reevaluation_reminder_delivery"
                                )
                            )
                        )

                        result = self.db.execute(statement)

                        if result.rowcount == 0:
                            continue

                        created += result.rowcount

                        notification_service.create(
                            user_id=user.id,
                            company_id=company.id,
                            event_type=(
                                NotificationEventType
                                .REEVALUATION_REMINDER
                            ),
                            channel=notification_channel,
                            title="Recordatorio de reevaluación",
                            message=(
                                f"La próxima reevaluación de "
                                f"{company.name} está programada "
                                f"para el {target_date.isoformat()}."
                            ),
                            deduplication_key=(
                                f"reevaluation:{user.id}:"
                                f"{company.id}:"
                                f"{target_date.isoformat()}:"
                                f"{reminder_type.value}"
                            ),
                            resource_type="reevaluation",
                        )

            self.db.commit()

        except Exception:
            self.db.rollback()
            raise

        return created


    def cancel_obsolete_in_app(self) -> int:
        pending_reminders = (
            self.db.query(ReevaluationReminder)
            .filter(
                ReevaluationReminder.channel
                == ReminderChannel.IN_APP,
                ReevaluationReminder.status
                == ReminderStatus.PENDING,
            )
            .all()
        )

        preference_service = NotificationPreferenceService(self.db)
        cancelled = 0

        try:
            for reminder in pending_reminders:
                user = reminder.user
                company = reminder.company

                active_membership = None

                if user is not None and company is not None:
                    active_membership = (
                        self.db.query(CompanyMembership.id)
                        .filter(
                            CompanyMembership.user_id == user.id,
                            CompanyMembership.company_id == company.id,
                            CompanyMembership.status
                            == CompanyMembershipStatus.ACTIVE,
                        )
                        .first()
                    )

                is_valid = (
                    user is not None
                    and user.active
                    and company is not None
                    and company.active
                    and active_membership is not None
                    and company.next_evaluation is not None
                    and company.next_evaluation.date()
                    == reminder.target_date
                    and preference_service.is_enabled(
                        user_id=user.id,
                        event_type=(
                            NotificationEventType
                            .REEVALUATION_REMINDER.value
                        ),
                        channel=NotificationChannel.IN_APP,
                    )
                )

                if is_valid:
                    continue

                reminder.status = ReminderStatus.CANCELLED
                cancelled += 1

                deduplication_key = (
                    f"reevaluation:{reminder.user_id}:"
                    f"{reminder.company_id}:"
                    f"{reminder.target_date.isoformat()}:"
                    f"{reminder.reminder_type.value}"
                )

                (
                    self.db.query(Notification)
                    .filter(
                        Notification.user_id == reminder.user_id,
                        Notification.company_id == reminder.company_id,
                        Notification.event_type
                        == NotificationEventType
                        .REEVALUATION_REMINDER.value,
                        Notification.channel
                        == NotificationChannel.IN_APP,
                        Notification.deduplication_key
                        == deduplication_key,
                        Notification.status.in_(
                            [
                                NotificationStatus.PENDING,
                                NotificationStatus.SENT,
                            ]
                        ),
                    )
                    .update(
                        {
                            Notification.status:
                                NotificationStatus.CANCELLED,
                        },
                        synchronize_session=False,
                    )
                )

            self.db.commit()

        except Exception:
            self.db.rollback()
            raise

        return cancelled
