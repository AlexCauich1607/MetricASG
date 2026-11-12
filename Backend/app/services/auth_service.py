from datetime import datetime, timedelta

from fastapi import HTTPException, Response, Request
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from uuid import uuid4
from jose import JWTError, jwt
from passlib.hash import argon2

from app.core.config import settings
from app.models.user_model import User

from app.models.refresh_session_model import RefreshSession

from app.core.roles import UserRole, CompanyRole

from ..models.company_model import Company
from ..models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)
from app.services.audit_service import AuditService

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

    def create_refresh_token(
        self,
        data: dict,
        db: Session,
        audit_login: bool = False,
    ):
        to_encode = data.copy()

        token_expire = datetime.utcnow() + timedelta(
            days=settings.refresh_token_expire_days
        )

        jti = str(uuid4())

        to_encode["exp"] = token_expire
        to_encode["jti"] = jti

        refresh_session = RefreshSession(
            user_id=int(data["id"]),
            jti=jti,
            expires_at=token_expire
        )

        db.add(refresh_session)

        if audit_login:
            AuditService.record(
                db=db,
                action="auth.login_succeeded",
                resource_type="user",
                resource_id=int(data["id"]),
                actor_id=int(data["id"]),
                context={},
            )

        db.commit()

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

        jti = payload.get("jti")

        if not jti:
            raise HTTPException(401, "Invalid refresh session")

        refresh_session = (
            db.query(RefreshSession)
            .filter(
                RefreshSession.jti == jti,
                RefreshSession.user_id == int(payload["id"])
            )
            .first()
        )

        if not refresh_session:
            raise HTTPException(401, "Invalid refresh session")

        if refresh_session.revoked_at is not None:
            raise HTTPException(401, "Refresh session revoked")

        if refresh_session.expires_at <= datetime.utcnow():
            raise HTTPException(401, "Refresh session expired")

        refresh_session.revoked_at = datetime.utcnow()

        new_access = self.create_token({
            "id": payload["id"],
            "role": payload["role"]
        })

        new_refresh = self.create_refresh_token(
            {
                "id": payload["id"],
                "role": payload["role"]
            },
            db
        )

        return {
            "token": new_access,
            "refresh_token": new_refresh
        }

    def login(self, email: str, password: str, db: Session):
        user = db.query(User).filter(User.email == email).first()

        if not user:
            AuditService.record(
                db=db,
                action="auth.login_failed",
                resource_type="user",
                context={"reason": "user_not_found"},
            )
            db.commit()

            raise HTTPException(404, "User not found")

        if not self.verify_password(password, user.password):
            AuditService.record(
                db=db,
                action="auth.login_failed",
                resource_type="user",
                resource_id=user.id,
                context={"reason": "invalid_credentials"},
            )
            db.commit()

            raise HTTPException(401, "Incorrect password")

        if not user.active:
            AuditService.record(
                db=db,
                action="auth.login_failed",
                resource_type="user",
                resource_id=user.id,
                context={"reason": "inactive_account"},
            )
            db.commit()

            raise HTTPException(401, "The account is not active")

        user.last_login = datetime.utcnow()
        db.commit()
        db.refresh(user)

        token = self.create_token({
            "id": str(user.id),
            "role": user.role
        })

        refresh_token = self.create_refresh_token(
            {
                "id": str(user.id),
                "role": user.role
            },
            db,
            audit_login=True,
        )

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

    def _create_company_account(self, data: dict, db: Session):
        if db.query(User).filter(User.email == data["email"]).first():
            raise HTTPException(400, "Email already registered")

        user_data = data.copy()
        user_data["password"] = self.hash_password(user_data["password"])
        user_data["role"] = UserRole.USER.value
        user_data["next_evaluation"] = datetime.now()

        try:
            company = Company(
                name=user_data["company_name"],
                sector_id=user_data.get("company_sector_id"),
                size_id=user_data.get("company_size_id"),
                active=True,
            )

            db.add(company)
            db.flush()

            user = User(**user_data)
            db.add(user)
            db.flush()

            membership = CompanyMembership(
                user_id=user.id,
                company_id=company.id,
                role=CompanyRole.COMPANY_ADMIN,
                status=CompanyMembershipStatus.ACTIVE,
            )

            db.add(membership)
            db.flush()

            AuditService.record(
                db=db,
                action="user.created",
                resource_type="user",
                resource_id=user.id,
                actor_id=user.id,
                company_id=company.id,
                context={
                    "registration_type": "company_account",
                },
            )

            db.commit()
            db.refresh(user)

            return user

        except Exception:
            db.rollback()
            raise

    def create_user(self, data: dict, db: Session):
        return self._create_company_account(data, db)

    def create_company(self, data: dict, db: Session):
        return self._create_company_account(data, db)

    def create_admin(
        self,
        data: dict,
        db: Session,
        actor_id: int,
    ):
        if db.query(User).filter(User.email == data["email"]).first():
            raise HTTPException(400, "Email already registered")

        admin_data = data.copy()
        admin_data["password"] = self.hash_password(
            admin_data["password"]
        )
        admin_data["company_name"] = admin_data["name"]
        admin_data["role"] = UserRole.ADMIN.value
        admin_data["next_evaluation"] = datetime.now()

        try:
            admin = User(**admin_data)

            db.add(admin)
            db.flush()

            AuditService.record(
                db=db,
                action="user.created",
                resource_type="user",
                resource_id=admin.id,
                actor_id=actor_id,
                context={
                    "registration_type": "global_admin",
                },
            )

            db.commit()
            db.refresh(admin)

            return admin

        except Exception:
            db.rollback()
            raise

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

        AuditService.record(
            db=db,
            action="user.password_changed",
            resource_type="user",
            resource_id=user.id,
            actor_id=user.id,
            context={},
        )

        db.commit()

        return {"success": True}


    def logout(self, request: Request, db: Session):
        refresh_token = request.cookies.get("refresh_token")

        if not refresh_token:
            return {"success": True}

        try:
            payload = jwt.decode(
                refresh_token,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm]
            )

            jti = payload.get("jti")

            if jti:
                refresh_session = (
                    db.query(RefreshSession)
                    .filter(RefreshSession.jti == jti)
                    .first()
                )

                if (
                    refresh_session
                    and refresh_session.revoked_at is None
                ):
                    refresh_session.revoked_at = datetime.utcnow()

                    AuditService.record(
                        db=db,
                        action="auth.logout_succeeded",
                        resource_type="user",
                        resource_id=refresh_session.user_id,
                        actor_id=refresh_session.user_id,
                        context={},
                    )

                    db.commit()

        except JWTError:
            pass

        return {"success": True}