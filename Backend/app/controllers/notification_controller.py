
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.notification_preference_model import (
    NotificationPreference,
)
from app.models.reevaluation_notification_response import (
    ReevaluationNotificationResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
)
from app.models.reevaluation_reminder_model import (
    ReevaluationReminder,
    ReminderChannel,
    ReminderStatus,
)
from app.models.user_model import User
from app.services.token_service import get_current_user


class NotificationController:

    def __init__(self):
        self.router = APIRouter(
            prefix="/api/notifications",
            tags=["Notifications"],
        )

        @self.router.get(
            "/me",
            response_model=list[ReevaluationNotificationResponse],
        )
        def get_my_notifications(
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            if (
                not current_user.active
                or current_user.next_evaluation is None
            ):
                return []

            return (
                db.query(ReevaluationReminder)
                .filter(
                    ReevaluationReminder.user_id == current_user.id,
                    ReevaluationReminder.channel == ReminderChannel.IN_APP,
                    ReevaluationReminder.target_date
                    == current_user.next_evaluation.date(),
                    ReevaluationReminder.status.in_([
                        ReminderStatus.PENDING,
                        ReminderStatus.SENT,
                    ]),
                )
                .order_by(ReevaluationReminder.created_at.desc())
                .all()
            )

        @self.router.get(
            "/preferences/me",
            response_model=NotificationPreferenceResponse,
        )
        def get_my_preferences(
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            preference = (
                db.query(NotificationPreference)
                .filter(
                    NotificationPreference.user_id == current_user.id
                )
                .first()
            )

            if preference is None:
                return NotificationPreferenceResponse(
                    in_app_enabled=True,
                    email_enabled=True,
                )

            return preference

        @self.router.put(
            "/preferences/me",
            response_model=NotificationPreferenceResponse,
        )
        def update_my_preferences(
            data: NotificationPreferenceUpdate,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            preference = (
                db.query(NotificationPreference)
                .filter(
                    NotificationPreference.user_id == current_user.id
                )
                .first()
            )

            if preference is None:
                preference = NotificationPreference(
                    user_id=current_user.id,
                )
                db.add(preference)

            preference.in_app_enabled = data.in_app_enabled
            preference.email_enabled = data.email_enabled

            db.commit()
            db.refresh(preference)

            return preference
