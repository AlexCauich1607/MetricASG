from typing import Optional
from ..services.token_service import get_current_user, get_is_admin
from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database.database import get_db
from app.services.auth_service import AuthService


auth_service = AuthService()

class RefreshRequest(BaseModel):
    refresh_token: str
    

class LoginRequest(BaseModel):
    email: str
    password: str

class ChangePasswordRequest(BaseModel):
    id_user: int
    new_password: str
    bf_password: str


class RegisterRequest(BaseModel):
    name: str
    lastname: str
    position: str
    
    company_name: str
    company_sector_id: Optional[int] = None
    company_size_id: Optional[int] = None
    
    email: str
    phone: str
    password: str


class RegisterCompanyRequest(BaseModel):
    company_name: str
    company_sector_id: Optional[int] = None
    company_size_id: Optional[int] = None
    
    email: str
    phone: str
    password: str

class AdminRequest(BaseModel):
    name: str
    lastname: str
    email: str
    password: str



class AuthController:
    prefix = "auth"

    def __init__(self):
        self.router = APIRouter(
            prefix=f"/api/{self.prefix}",
            tags=["Auth"]
        )
        
        @self.router.post("/login")
        def login(payload: LoginRequest,response: Response, db: Session = Depends(get_db)):
            result =  auth_service.login(
                payload.email,
                payload.password,
                db
            )
            
            response.set_cookie(
                key="refresh_token",
                value=result["refresh_token"],
                httponly=True,
                secure=False,        
                samesite="lax",
                max_age=60 * 60 * 24 * 7
            )

            result.pop("refresh_token")

            return result

  
        @self.router.post("/register")
        def register(payload: RegisterRequest, db: Session = Depends(get_db)):
            return auth_service.create_user(payload.dict(), db)
        
        @self.router.post("/register-company")
        def register_company(payload: RegisterCompanyRequest, db: Session = Depends(get_db)):
            return auth_service.create_company(payload.dict(), db)
     
        @self.router.post("/create-admin", dependencies=[Depends(get_is_admin)])
        def create_admin(payload: AdminRequest, db: Session = Depends(get_db)):
            return auth_service.create_admin(payload.dict(), db)
        
        @self.router.post("/refresh-token")
        def refresh_token(payload: Request, db: Session = Depends(get_db)):
            return auth_service.refresh(payload, db)
        
        @self.router.post("/change-password")
        def change_password(payload: ChangePasswordRequest, db: Session = Depends(get_db)):
            return auth_service.chage_password(
                payload.id_user,
                payload.new_password,
                payload.bf_password,
                db
            )
            
    