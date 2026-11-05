
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from app.core.config import settings
from sqlalchemy import exists
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

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

        completed_evaluation_exists = (
            exists()
            .where(Evaluation.user_id == User.id)
            .where(
                Evaluation.status == EvaluationStatus.COMPLETED
            )
        )

        users = (
            self.db.query(User, NotificationPreference)
            .outerjoin(
                NotificationPreference,
                NotificationPreference.user_id == User.id,
            )
            .filter(
                User.active.is_(True),
                User.next_evaluation.isnot(None),
                completed_evaluation_exists,
            )
            .all()
        )

        created = 0

        try:
            for user, preferences in users:
                target_date = user.next_evaluation.date()

                reminder_type = reminder_dates.get(target_date)

                if reminder_type is None:
                    continue

                in_app_enabled = (
                    preferences is None
                    or preferences.in_app_enabled
                )

                email_enabled = (
                    preferences is None
                    or preferences.email_enabled
                )

                channels = []

                if in_app_enabled:
                    channels.append(ReminderChannel.IN_APP)

                if email_enabled:
                    channels.append(ReminderChannel.EMAIL)

                for channel in channels:
                    statement = (
                        insert(ReevaluationReminder)
                        .values(
                            user_id=user.id,
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

                    created += result.rowcount

            self.db.commit()

        except Exception:
            self.db.rollback()
            raise

        return created


    def cancel_obsolete_in_app(self) -> int:
        pending_reminders = (
            self.db.query(ReevaluationReminder)
            .join(
                User,
                User.id == ReevaluationReminder.user_id,
            )
            .outerjoin(
                NotificationPreference,
                NotificationPreference.user_id == User.id,
            )
            .filter(
                ReevaluationReminder.channel
                == ReminderChannel.IN_APP,
                ReevaluationReminder.status
                == ReminderStatus.PENDING,
            )
            .all()
        )

        cancelled = 0

        try:
            for reminder in pending_reminders:
                user = reminder.user
                preferences = user.notification_preference

                is_valid = (
                    user.active
                    and user.next_evaluation is not None
                    and user.next_evaluation.date()
                    == reminder.target_date
                    and (
                        preferences is None
                        or preferences.in_app_enabled
                    )
                )

                if not is_valid:
                    reminder.status = ReminderStatus.CANCELLED
                    cancelled += 1

            self.db.commit()

        except Exception:
            self.db.rollback()
            raise

        return cancelled
