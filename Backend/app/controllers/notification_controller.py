
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

from app.models.notification_event_preference_model import (
    NotificationEventPreference,
)
from app.models.notification_event_preference_request import (
    NotificationEventType,
    NotificationEventPreferenceResponse,
    NotificationEventPreferenceUpdate,
)
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.sql import func

from fastapi import Query

from app.models.notification_model import (
    Notification,
    NotificationChannel,
    NotificationStatus,
)

from app.models.notification_center_response import (
    NotificationCenterResponse,
    NotificationUnreadCountResponse,
)
from fastapi import HTTPException, status
from sqlalchemy import update

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

        @self.router.get(
            "/preferences/me/events",
            response_model=list[NotificationEventPreferenceResponse],
        )
        def get_my_event_preferences(
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            preferences = (
                db.query(NotificationEventPreference)
                .filter(
                    NotificationEventPreference.user_id == current_user.id
                )
                .all()
            )

            preferences_by_event = {
                preference.event_type: preference
                for preference in preferences
            }

            return [
                NotificationEventPreferenceResponse(
                    event_type=event,
                    in_app_enabled=(
                        preferences_by_event[event.value].in_app_enabled
                        if event.value in preferences_by_event
                        else True
                    ),
                    email_enabled=(
                        preferences_by_event[event.value].email_enabled
                        if event.value in preferences_by_event
                        else True
                    ),
                )
                for event in NotificationEventType
            ]

        @self.router.put(
            "/preferences/me/events/{event_type}",
            response_model=NotificationEventPreferenceResponse,
        )
        def update_my_event_preference(
            event_type: NotificationEventType,
            data: NotificationEventPreferenceUpdate,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            statement = insert(NotificationEventPreference).values(
                user_id=current_user.id,
                event_type=event_type.value,
                in_app_enabled=data.in_app_enabled,
                email_enabled=data.email_enabled,
            )

            statement = statement.on_conflict_do_update(
                constraint="uq_notification_event_preference_user_event",
                set_={
                    "in_app_enabled": statement.excluded.in_app_enabled,
                    "email_enabled": statement.excluded.email_enabled,
                    "updated_at": func.now(),
                },
            ).returning(NotificationEventPreference.id)

            try:
                preference_id = db.execute(statement).scalar_one()
                db.commit()
            except Exception:
                db.rollback()
                raise

            preference = db.get(
                NotificationEventPreference,
                preference_id,
            )

            return preference

        @self.router.get(
            "/me/center",
            response_model=list[NotificationCenterResponse],
        )
        def get_my_notification_center(
            limit: int = Query(default=20, ge=1, le=100),
            offset: int = Query(default=0, ge=0),
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return (
                db.query(Notification)
                .filter(
                    Notification.user_id == current_user.id,
                    Notification.channel == NotificationChannel.IN_APP,
                    Notification.status.in_(
                        [
                            NotificationStatus.PENDING,
                            NotificationStatus.SENT,
                        ]
                    ),
                )
                .order_by(
                    Notification.created_at.desc(),
                    Notification.id.desc(),
                )
                .offset(offset)
                .limit(limit)
                .all()
            )

        @self.router.get(
            "/me/unread-count",
            response_model=NotificationUnreadCountResponse,
        )
        def get_my_unread_notification_count(
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            unread_count = (
                db.query(Notification)
                .filter(
                    Notification.user_id == current_user.id,
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

            return NotificationUnreadCountResponse(
                unread_count=unread_count,
            )

        @self.router.patch(
            "/me/{notification_id}/read",
            response_model=NotificationCenterResponse,
        )
        def mark_my_notification_as_read(
            notification_id: int,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            statement = (
                update(Notification)
                .where(
                    Notification.id == notification_id,
                    Notification.user_id == current_user.id,
                    Notification.channel == NotificationChannel.IN_APP,
                    Notification.status.in_(
                        [
                            NotificationStatus.PENDING,
                            NotificationStatus.SENT,
                        ]
                    ),
                )
                .values(
                    read_at=func.coalesce(
                        Notification.read_at,
                        func.now(),
                    ),
                )
                .returning(Notification.id)
            )

            try:
                updated_id = db.execute(statement).scalar_one_or_none()

                if updated_id is not None:
                    db.commit()

            except Exception:
                db.rollback()
                raise

            if updated_id is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Notification not found",
                )

            notification = db.get(Notification, updated_id)

            return notification