from ..services.token_service import get_is_admin
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database.database import get_db
from ..services.admin_service import AdminService


admin_service = AdminService()


class AdminController:
    prefix = "admin"

    def __init__(self):
        self.router = APIRouter(
            prefix=f"/api/{self.prefix}",
            tags=["Admin"], 
            dependencies=[Depends(get_is_admin)]
        )
        
        @self.router.get("/summary")
        def get_dashboard_summary(db: Session = Depends(get_db)):
            return admin_service.get_summary(db)
        
        @self.router.get("/users")
        def get_all_users(db: Session = Depends(get_db)):
            return admin_service.getUsers(db)
          
        @self.router.post("/change-user-state/{user_id}")
        def change_user_state(user_id: int, db: Session = Depends(get_db)):
            return admin_service.change_user_state(user_id, db)
            
    