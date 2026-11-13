from sqlalchemy.orm import Session

from app.models.notification_event_preference_model import (
    NotificationEventPreference,
)
from app.models.notification_model import NotificationChannel
from app.models.notification_preference_model import (
    NotificationPreference,
)


class NotificationPreferenceService:

    def __init__(self, db: Session):
        self.db = db

    def is_enabled(
        self,
        user_id: int,
        event_type: str,
        channel: NotificationChannel,
    ) -> bool:
        if not isinstance(channel, NotificationChannel):
            channel = NotificationChannel(channel)

        global_preference = (
            self.db.query(NotificationPreference)
            .filter(
                NotificationPreference.user_id == user_id
            )
            .first()
        )

        event_preference = (
            self.db.query(NotificationEventPreference)
            .filter(
                NotificationEventPreference.user_id == user_id,
                NotificationEventPreference.event_type == event_type,
            )
            .first()
        )

        if channel == NotificationChannel.IN_APP:
            global_enabled = (
                global_preference is None
                or global_preference.in_app_enabled
            )

            event_enabled = (
                event_preference is None
                or event_preference.in_app_enabled
            )

        elif channel == NotificationChannel.EMAIL:
            global_enabled = (
                global_preference is None
                or global_preference.email_enabled
            )

            event_enabled = (
                event_preference is None
                or event_preference.email_enabled
            )

        return bool(global_enabled and event_enabled)
