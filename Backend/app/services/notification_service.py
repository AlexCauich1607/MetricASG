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


class NotificationService:

    def __init__(self, db: Session):
        self.db = db
        self.preference_service = NotificationPreferenceService(db)

    def create(
        self,
        *,
        user_id: int,
        event_type: NotificationEventType,
        channel: NotificationChannel,
        title: str,
        message: str,
        deduplication_key: str,
        company_id: int | None = None,
        resource_type: str | None = None,
        resource_id: int | None = None,
    ) -> bool:
        if not isinstance(event_type, NotificationEventType):
            event_type = NotificationEventType(event_type)

        if not isinstance(channel, NotificationChannel):
            channel = NotificationChannel(channel)

        enabled = self.preference_service.is_enabled(
            user_id=user_id,
            event_type=event_type.value,
            channel=channel,
        )

        if not enabled:
            return False

        statement = (
            insert(Notification)
            .values(
                user_id=user_id,
                company_id=company_id,
                event_type=event_type.value,
                channel=channel,
                title=title,
                message=message,
                resource_type=resource_type,
                resource_id=resource_id,
                deduplication_key=deduplication_key,
                status=NotificationStatus.PENDING,
            )
            .on_conflict_do_nothing(
                constraint="uq_notification_recipient_channel_event"
            )
        )

        result = self.db.execute(statement)

        return result.rowcount == 1
