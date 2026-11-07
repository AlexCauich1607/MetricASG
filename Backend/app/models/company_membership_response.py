
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from .company_membership_model import CompanyMembershipStatus


class CompanyMemberResponse(BaseModel):
    membership_id: int
    user_id: int
    name: str | None
    lastname: str | None
    email: str
    position: str | None
    status: CompanyMembershipStatus
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)
