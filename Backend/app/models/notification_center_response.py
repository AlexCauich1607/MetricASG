from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.notification_model import (
    NotificationChannel,
    NotificationStatus,
)


class NotificationCenterResponse(BaseModel):
    id: int
    event_type: str
    channel: NotificationChannel
    status: NotificationStatus
    title: str
    message: str
    company_id: int | None
    resource_type: str | None
    resource_id: int | None
    created_at: datetime
    read_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class NotificationUnreadCountResponse(BaseModel):
    unread_count: int
