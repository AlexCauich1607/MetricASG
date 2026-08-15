from decimal import Decimal
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, Type, List, Any, Dict
from pydantic import create_model
from ..services.token_service import get_current_user
from app.database.database import get_db
from app.services.base_service import BaseService

def generate_schema(model: Type):
    fields = {}

    for column in model.__table__.columns:
        python_type = getattr(column.type, "python_type", Any)

        if python_type is Decimal:
            python_type = float

        if column.nullable or column.default is not None:
            python_type = Optional[python_type]
            default = None
        else:
            default = ...

        fields[column.name] = (python_type, default)

    return create_model(f"{model.__name__}Schema", **fields)

class BaseController:
    model: Type = None
    prefix: str = None
    
    read_only_admin: bool =  False
    read_all_only_admin: bool = False
    create_only_admin: bool = False
    update_only_admin: bool = False
    delete_only_admin: bool = False
    

    def __init__(self):
        if not self.model or not self.prefix:
            raise Exception("Debes definir 'model' y 'prefix' en la clase hija.")

        self.Schema = generate_schema(self.model)
        self.router = APIRouter(prefix=f"/api/{self.prefix}", tags=[self.prefix.capitalize()], dependencies=[Depends(get_current_user)])

        @self.router.get("/", response_model=List[self.Schema])
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

        @self.router.get("/{item_id}", response_model=self.Schema)
        def read(item_id: int, db: Session = Depends(get_db)):
            obj = BaseService(self.model, db).read(item_id)
            if not obj:
                raise HTTPException(404, "Item not found")
            return obj

        @self.router.post("/", response_model=self.Schema)
        def create(data: Dict[str, Any], db: Session = Depends(get_db)):
            return BaseService(self.model, db).create(data)

        @self.router.put("/{item_id}", response_model=self.Schema)
        def update(item_id: int, data: Dict[str, Any], db: Session = Depends(get_db)):
            updated = BaseService(self.model, db).update(item_id, data)
            if not updated:
                raise HTTPException(404, "Item not found")
            return updated

        @self.router.delete("/{item_id}")
        def delete(item_id: int, db: Session = Depends(get_db)):
            deleted = BaseService(self.model, db).delete(item_id)
            if not deleted:
                raise HTTPException(404, "Item not found")
            return {"success": True}
