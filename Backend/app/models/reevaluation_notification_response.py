
from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict


class ReminderTypeResponse(str, Enum):
    FIRST = "FIRST"
    SECOND = "SECOND"
    DUE = "DUE"


class ReevaluationNotificationResponse(BaseModel):
    id: int
    target_date: date
    reminder_type: ReminderTypeResponse
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationPreferenceResponse(BaseModel):
    in_app_enabled: bool
    email_enabled: bool


class NotificationPreferenceUpdate(BaseModel):
    in_app_enabled: bool
    email_enabled: bool
