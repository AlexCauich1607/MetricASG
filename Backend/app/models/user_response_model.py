from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserResponse(BaseModel):
    
    id: int
    # Información de usuario
    name: Optional[str] = None
    lastname: Optional[str] = None
    position: Optional[str] = None

    # Información de la empresa
    company_name: str
    company_sector_id: Optional[int] = None
    company_size_id: Optional[int] = None

    # Información de contacto
    email: str
    phone: Optional[str] = None

    # Información extra
    profile_photo: Optional[str] = None
    role: str
    joined: Optional[datetime] = None
    last_login: Optional[datetime] = None
    biannual_evaluation: bool
    next_evaluation: Optional[datetime] = None
    active: bool

    class Config:
        from_attributes = True   
