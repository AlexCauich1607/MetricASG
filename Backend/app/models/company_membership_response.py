
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from .company_membership_model import CompanyMembershipStatus
from app.core.roles import CompanyRole

class CompanyMemberResponse(BaseModel):
    membership_id: int
    user_id: int
    name: str | None
    lastname: str | None
    email: str
    position: str | None
    role: CompanyRole
    status: CompanyMembershipStatus
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserCompanyMembershipResponse(BaseModel):
    membership_id: int
    company_id: int
    company_name: str
    role: CompanyRole
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)
