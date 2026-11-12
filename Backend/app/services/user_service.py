from app.services.auth_service import AuthService
from app.services.audit_service import AuditService
from app.services.base_service import BaseService


class UserService(BaseService):

    def create(self, data: dict, actor_id: int):
        try:
            user_data = data.copy()

            user_data["password"] = AuthService().hash_password(
                user_data["password"]
            )

            user = self.model(**user_data)

            self.db.add(user)
            self.db.flush()

            AuditService.record(
                db=self.db,
                action="user.created",
                resource_type="user",
                resource_id=user.id,
                actor_id=actor_id,
                context={},
            )

            self.db.commit()
            self.db.refresh(user)

            return user

        except Exception:
            self.db.rollback()
            raise

    def update_profile(
        self,
        user_id: int,
        data: dict,
    ):
        user = self.read(user_id)

        if user is None:
            return None

        protected_fields = {
            "id",
            "role",
            "active",
            "password",
        }

        try:
            for key, value in data.items():
                if key not in protected_fields and hasattr(user, key):
                    setattr(user, key, value)

            self.db.flush()

            AuditService.record(
                db=self.db,
                action="user.profile_updated",
                resource_type="user",
                resource_id=user.id,
                actor_id=user_id,
                context={},
            )

            self.db.commit()
            self.db.refresh(user)

            return user

        except Exception:
            self.db.rollback()
            raise

    def update(
        self,
        item_id: int,
        data: dict,
        actor_id: int,
    ):
        user = (
            self.db.query(self.model)
            .filter(self.model.id == item_id)
            .first()
        )

        if user is None:
            return None

        try:
            protected_fields = {
                "id",
                "role",
                "active",
                "password",
            }

            for key, value in data.items():
                if key not in protected_fields and hasattr(user, key):
                    setattr(user, key, value)

            self.db.flush()

            AuditService.record(
                db=self.db,
                action="user.updated",
                resource_type="user",
                resource_id=user.id,
                actor_id=actor_id,
                context={},
            )

            self.db.commit()
            self.db.refresh(user)

            return user

        except Exception:
            self.db.rollback()
            raise
