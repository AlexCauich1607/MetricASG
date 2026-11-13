from enum import Enum

from pydantic import BaseModel, ConfigDict


class NotificationEventType(str, Enum):
    REEVALUATION_REMINDER = "REEVALUATION_REMINDER"
    COMPANY_INVITATION_CREATED = "COMPANY_INVITATION_CREATED"
    COMPANY_INVITATION_RESENT = "COMPANY_INVITATION_RESENT"
    IMPROVEMENT_ACTION_DUE = "IMPROVEMENT_ACTION_DUE"
    IMPROVEMENT_ACTION_OVERDUE = "IMPROVEMENT_ACTION_OVERDUE"


class NotificationEventPreferenceUpdate(BaseModel):
    in_app_enabled: bool
    email_enabled: bool


class NotificationEventPreferenceResponse(BaseModel):
    event_type: NotificationEventType
    in_app_enabled: bool
    email_enabled: bool

    model_config = ConfigDict(from_attributes=True)
