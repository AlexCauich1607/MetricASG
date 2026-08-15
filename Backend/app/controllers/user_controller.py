from decimal import Decimal
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, Type, List, Any, Dict
from pydantic import create_model
from ..services.token_service import get_current_user, get_is_admin
from ..database.database import get_db
from ..services.base_service import BaseService
from .base_controller import generate_schema
from ..models.user_model import User
from ..utils.orm import orm_to_dict
from ..models.user_response_model import UserResponse

class UsersController:
    model: Type = User 
    prefix: str = "users"
    

    def __init__(self):
        self.Schema = generate_schema(self.model)
        self.router = APIRouter(prefix=f"/api/{self.prefix}", tags=[self.prefix.capitalize()], dependencies=[Depends(get_current_user)])

        @self.router.get("/", response_model=List[UserResponse],dependencies=[Depends(get_is_admin)])
        def read_all(
            db: Session = Depends(get_db),
            order_by: Optional[str] = Query(None),
            order_dir: str = Query("asc"),
            filters: Optional[str] = Query(None)
        ):
            import json
            filters_dict = json.loads(filters) if filters else {}
            return BaseService(self.model, db).read_all(
                filters=filters_dict,
                order_by=order_by,
                order_dir=order_dir
            )

        @self.router.get("/{item_id}", response_model=UserResponse)
        def read(item_id: int, db: Session = Depends(get_db)):
            obj = BaseService(self.model, db).read(item_id)
            if not obj:
                raise HTTPException(404, "Item not found")
            data = orm_to_dict(obj)
            data.pop("password", None)
            return data

        @self.router.post("/", response_model=self.Schema, dependencies=[Depends(get_is_admin)])
        def create(data: Dict[str, Any], db: Session = Depends(get_db)):
            return BaseService(self.model, db).create(data)

        @self.router.put("/{item_id}", response_model=self.Schema)
        def update(item_id: int, data: Dict[str, Any], db: Session = Depends(get_db)):
            data.pop("role", None)
            data.pop("active", None)
                
            updated = BaseService(self.model, db).update(item_id, data)
            if not updated:
                raise HTTPException(404, "Item not found")
            return updated

        @self.router.delete("/{item_id}", dependencies=[Depends(get_is_admin)])
        def delete(item_id: int, db: Session = Depends(get_db)):
            deleted = BaseService(self.model, db).delete(item_id)
            if not deleted:
                raise HTTPException(404, "Item not found")
            return {"success": True}
