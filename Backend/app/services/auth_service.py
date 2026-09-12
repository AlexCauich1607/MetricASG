from datetime import datetime, timedelta

from fastapi import HTTPException, Response, Request
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt
from passlib.hash import argon2

from app.core.config import settings
from app.models.user_model import User

from app.core.roles import UserRole


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:

    def hash_password(self, password: str) -> str:
        return argon2.hash(password[:72])

    def verify_password(self, plain: str, hashed: str) -> bool:
        return argon2.verify(plain, hashed)

    def create_token(self, data: dict):
        to_encode = data.copy()

        expire = datetime.utcnow() + timedelta(
            minutes=settings.access_token_expire_minutes
        )

        to_encode["exp"] = expire

        return jwt.encode(
            to_encode,
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm
        )

    def create_refresh_token(self, data: dict):
        to_encode = data.copy()

        token_expire = datetime.utcnow() + timedelta(
            days=settings.refresh_token_expire_days
        )

        to_encode["exp"] = token_expire

        return jwt.encode(
            to_encode,
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm
        )

    def refresh(self, request: Request, db: Session):
        refresh_token = request.cookies.get("refresh_token")

        if not refresh_token:
            raise HTTPException(401, "No refresh token")

        payload = jwt.decode(
            refresh_token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )

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

        token = self.create_token({
            "id": str(user.id),
            "role": user.role
        })

        refresh_token = self.create_refresh_token({
            "id": str(user.id),
            "role": user.role
        })

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
        data["role"] = UserRole.USER.value
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
        data["role"] = UserRole.USER.value
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
        data["role"] = UserRole.ADMIN.value
        data["next_evaluation"] = datetime.now()

        admin = User(**data)
        db.add(admin)
        db.commit()
        db.refresh(admin)

        return admin

    def chage_password(
        self,
        user_id: int,
        new_password: str,
        bf_password: str,
        db: Session
    ):
        user = db.query(User).filter(User.id == user_id).first()

        if not user:
            raise HTTPException(404, "User not found")

        if not self.verify_password(bf_password, user.password):
            raise HTTPException(401, "Incorrect password")

        user.password = self.hash_password(new_password)
        db.commit()
        db.refresh(user)

        return user