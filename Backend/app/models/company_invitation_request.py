
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.company_invitation_model import (
    CompanyInvitationStatus,
)
from app.core.roles import CompanyRole

class CompanyInvitationCreate(BaseModel):
    company_id: int = Field(gt=0)
    email: EmailStr
    role: CompanyRole = CompanyRole.COLLABORATOR


class CompanyInvitationAccept(BaseModel):
    token: str = Field(min_length=1)


class CompanyInvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    invited_by_user_id: int
    email: EmailStr
    role: CompanyRole
    status: CompanyInvitationStatus
    expires_at: datetime
    created_at: datetime
    accepted_at: datetime | None = None
    last_resent_at: datetime | None = None


class CompanyInvitationAcceptedResponse(BaseModel):
    membership_id: int
    company_id: int
    user_id: int
    status: str
