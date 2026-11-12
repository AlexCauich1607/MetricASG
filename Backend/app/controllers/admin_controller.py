from ..services.token_service import get_current_user, require_admin
from ..models.user_model import User
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database.database import get_db
from ..services.admin_service import AdminService
from datetime import datetime, timezone

from ..services.audit_service import AuditService

admin_service = AdminService()


class AdminController:
    prefix = "admin"

    def __init__(self):
        self.router = APIRouter(
            prefix=f"/api/{self.prefix}",
            tags=["Admin"], 
            dependencies=[Depends(require_admin)]
        )
        
        @self.router.get("/summary")
        def get_dashboard_summary(db: Session = Depends(get_db)):
            return admin_service.get_summary(db)
        
        @self.router.get("/users")
        def get_all_users(db: Session = Depends(get_db)):
            return admin_service.getUsers(db)
          
        @self.router.post("/change-user-state/{user_id}")
        def change_user_state(
            user_id: int,
            db: Session = Depends(get_db),
            current_user: User = Depends(get_current_user),
        ):
            return admin_service.change_user_state(
                user_id,
                db,
                actor_id=current_user.id,
            )

        @self.router.get("/audit-logs")
        def get_audit_logs(
            actor_id: int | None = Query(default=None, ge=1),
            company_id: int | None = Query(default=None, ge=1),
            action: str | None = Query(default=None, min_length=1),
            resource_type: str | None = Query(
                default=None,
                min_length=1,
            ),
            resource_id: int | None = Query(default=None, ge=1),
            start_date: datetime | None = None,
            end_date: datetime | None = None,
            limit: int = Query(default=20, ge=1, le=100),
            offset: int = Query(default=0, ge=0),
            db: Session = Depends(get_db),
        ):
            if start_date is not None and (
                start_date.tzinfo is None
                or start_date.utcoffset() is None
            ):
                raise HTTPException(
                    status_code=422,
                    detail="start_date must include a timezone",
                )

            if end_date is not None and (
                end_date.tzinfo is None
                or end_date.utcoffset() is None
            ):
                raise HTTPException(
                    status_code=422,
                    detail="end_date must include a timezone",
                )

            if (
                start_date is not None
                and end_date is not None
                and start_date > end_date
            ):
                raise HTTPException(
                    status_code=422,
                    detail="start_date cannot be after end_date",
                )

            return AuditService.list_logs(
                db=db,
                actor_id=actor_id,
                company_id=company_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                start_date=start_date,
                end_date=end_date,
                limit=limit,
                offset=offset,
            )
