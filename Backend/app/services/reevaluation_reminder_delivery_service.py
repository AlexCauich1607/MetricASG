
import logging

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.config import settings
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
from app.services.reevaluation_email_service import (
    ReevaluationEmailService,
)


logger = logging.getLogger(__name__)


class ReevaluationReminderDeliveryService:

    REMINDER_SCHEDULE = {
        ReminderType.FIRST: 30,
        ReminderType.SECOND: 7,
        ReminderType.DUE: 0,
    }

    def __init__(
        self,
        db: Session,
        email_service=None,
        timezone: str | None = None,
    ):
        self.db = db
        self.email_service = (
            email_service or ReevaluationEmailService()
        )
        self.timezone = ZoneInfo(
            timezone or settings.reminder_timezone
        )

    def deliver_pending(self, today=None) -> dict:
        if not settings.smtp_enabled:
            logger.info(
                "SMTP disabled. Pending email reminders "
                "will not be processed."
            )
            return {
                "sent": 0,
                "failed": 0,
                "cancelled": 0,
            }

        if today is None:
            today = datetime.now(self.timezone).date()

        results = {
            "sent": 0,
            "failed": 0,
            "cancelled": 0,
        }

        pending_ids = [
            reminder_id
            for (reminder_id,) in (
                self.db.query(ReevaluationReminder.id)
                .filter(
                    ReevaluationReminder.channel
                    == ReminderChannel.EMAIL,
                    ReevaluationReminder.status
                    == ReminderStatus.PENDING,
                )
                .order_by(ReevaluationReminder.id)
                .all()
            )
        ]

        self.db.commit()

        for reminder_id in pending_ids:
            try:
                reminder = (
                    self.db.query(ReevaluationReminder)
                    .filter(
                        ReevaluationReminder.id == reminder_id,
                        ReevaluationReminder.channel
                        == ReminderChannel.EMAIL,
                        ReevaluationReminder.status
                        == ReminderStatus.PENDING,
                    )
                    .with_for_update(skip_locked=True)
                    .first()
                )

                if reminder is None:
                    self.db.rollback()
                    continue

                user = self.db.get(User, reminder.user_id)

                preferences = (
                    self.db.query(NotificationPreference)
                    .filter(
                        NotificationPreference.user_id
                        == reminder.user_id
                    )
                    .first()
                )

                if not self._is_eligible(
                    reminder,
                    user,
                    preferences,
                    today,
                ):
                    reminder.status = ReminderStatus.CANCELLED
                    self.db.commit()
                    results["cancelled"] += 1
                    continue

                try:
                    self.email_service.send(
                        user.email,
                        reminder,
                    )

                except Exception:
                    logger.exception(
                        "Email delivery failed for reminder %s",
                        reminder.id,
                    )

                    reminder.status = ReminderStatus.FAILED
                    self.db.commit()

                    results["failed"] += 1
                    continue

                reminder.status = ReminderStatus.SENT
                reminder.sent_at = datetime.now(
                    ZoneInfo("UTC")
                )

                self.db.commit()
                results["sent"] += 1

            except Exception:
                self.db.rollback()
                logger.exception(
                    "Unexpected error processing reminder %s",
                    reminder_id,
                )
                raise

        return results

    def _is_eligible(
        self,
        reminder,
        user,
        preferences,
        today,
    ) -> bool:
        if user is None or not user.active:
            return False

        if user.next_evaluation is None:
            return False

        if user.next_evaluation.date() != reminder.target_date:
            return False

        if (
            preferences is not None
            and not preferences.email_enabled
        ):
            return False

        days_before = self.REMINDER_SCHEDULE.get(
            reminder.reminder_type
        )

        if days_before is None:
            return False

        expected_date = (
            reminder.target_date
            - timedelta(days=days_before)
        )

        return today == expected_date
