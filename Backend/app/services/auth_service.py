import os
from datetime import datetime, timedelta

from fastapi import HTTPException, Response, Request
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt
from passlib.hash import argon2

from app.models.user_model import User


SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY environment variable is required"
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:

    def hash_password(self, password: str) -> str:
        return argon2.hash(password[:72])

    def verify_password(self, plain: str, hashed: str) -> bool:
        return argon2.verify(plain, hashed)

    def create_token(self, data: dict):
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode["exp"] = expire
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    def create_refresh_token(self, data: dict):
        to_encode = data.copy()
        token_expire = datetime.utcnow() + timedelta(days=30)
        to_encode["exp"] = token_expire
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    def refresh(self, request: Request , db:Session):
        refresh_token = request.cookies.get("refresh_token")

        if not refresh_token:
            raise HTTPException(401, "No refresh token")

        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])

        new_access = self.create_token({
            "id": payload["id"],
            "role": payload["role"]
        })

        return {"token": new_access}
        
    
    def login(self, email: str, password: str, db: Session):
        user = db.query(User).filter(User.email == email).first()

        if not user:
            raise HTTPException(404, "User not found")

        if not self.verify_password(password, user.password):
            raise HTTPException(401, "Incorrect password")
        if not user.active:
            raise HTTPException(401, "The account is not active")
        
        user.last_login = datetime.utcnow()
        db.commit()
        db.refresh(user)

        token = self.create_token({"id": str(user.id), "role": user.role})
        refresh_token = self.create_refresh_token({"id": str(user.id), "role": user.role})


        return {
            "access_token": token,
            "token_type": "bearer",
            "refresh_token": refresh_token,
            "user": {
                "id": user.id,
                "name": user.name,
                "company_name": user.company_name,
                "role": user.role,
                "email": user.email,
                "profile_photo": user.profile_photo,
                "last_login": user.last_login
            }
        }

    def create_user(self, data: dict, db: Session):
        if db.query(User).filter(User.email == data["email"]).first():
            raise HTTPException(400, "Email already registered")

        data["password"] = self.hash_password(data["password"])
        data["role"] = "user"
        data["next_evaluation"] = datetime.now()

        user = User(**data)
        db.add(user)
        db.commit()
        db.refresh(user)

        return user
    
    def create_company(self, data: dict, db: Session):
        if db.query(User).filter(User.email == data["email"]).first():
            raise HTTPException(400, "Email already registered")

        data["password"] = self.hash_password(data["password"])
        data["role"] = "company"
        data["next_evaluation"] = datetime.now()

        user = User(**data)
        db.add(user)
        db.commit()
        db.refresh(user)
        
        return user
   
    def create_admin(self, data: dict, db: Session):
        if db.query(User).filter(User.email == data["email"]).first():
            raise HTTPException(400, "Email already registered")

        data["password"] = self.hash_password(data["password"])
        data["company_name"] = data["name"]
        data["role"] = "admin"
        data["next_evaluation"] = datetime.now()

        admin = User(**data)
        db.add(admin)
        db.commit()
        db.refresh(admin)

        return admin
    
    def chage_password(self, user_id: int, new_password: str, bf_password: str, db: Session):
        user = db.query(User).filter(User.id == user_id).first()

        if not user:
            raise HTTPException(404, "User not found")

        if not self.verify_password(bf_password, user.password):
            raise HTTPException(401, "Incorrect password")
        
        user.password = self.hash_password(new_password)
        db.commit()
        db.refresh(user)
        
        return user
        