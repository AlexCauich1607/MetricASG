from typing import Any, Dict

from fastapi import Depends
from sqlalchemy.orm import Session

from app.controllers.base_controller import BaseController
from app.database.database import get_db
from app.models.company_relationship_model import CompanyRelationship
from app.models.user_model import User
from app.services.base_service import BaseService
from app.services.token_service import get_current_user


class CompanyRelationshipController(BaseController):
    model = CompanyRelationship
    prefix = "company-relationships"

    read_only_admin = True
    read_all_only_admin = True
    create_only_admin = True
    update_only_admin = True
    delete_only_admin = True

    def __init__(self):
        super().__init__()

        @self.router.post("/me", response_model=self.Schema)
        def create_current_user_relationship(
            data: Dict[str, Any],
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db)
        ):
            data.pop("id", None)
            data.pop("parent_company_id", None)

            data["parent_company_id"] = current_user.id

            return BaseService(self.model, db).create(data)