
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int

    # Información personal
    name: Optional[str] = None
    lastname: Optional[str] = None
    position: Optional[str] = None

    # Contacto
    email: str
    phone: Optional[str] = None

    # Información de la cuenta
    profile_photo: Optional[str] = None
    role: str
    joined: Optional[datetime] = None
    last_login: Optional[datetime] = None
    active: bool
