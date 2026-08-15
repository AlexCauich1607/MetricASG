from sqlalchemy.orm import Session
from sqlalchemy import asc, desc
from typing import Dict, Any


class BaseService:
    def __init__(self, model, db: Session):
        self.model = model
        self.db = db

    def read_all(self, filters=None, order_by=None, order_dir="asc"):
        query = self.db.query(self.model)

        if filters:
            for field, value in filters.items():
                if value is not None and hasattr(self.model, field):
                    column = getattr(self.model, field)
                    if isinstance(value, (list, tuple, set)):
                        query = query.filter(column.in_(value))
                    elif isinstance(value, str):
                        query = query.filter(column.ilike(f"{value}%"))
                    else:
                        query = query.filter(column == value)
                    
        if order_by and hasattr(self.model, order_by):
            order_col = getattr(self.model, order_by)
            query = query.order_by(asc(order_col) if order_dir == "asc" else desc(order_col))

        return query.all()

    def read(self, item_id: int):
        return self.db.query(self.model).filter(self.model.id == item_id).first()

    def create(self, data: Dict[str, Any]):
        obj = self.model(**data)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def update(self, item_id: int, data: Dict[str, Any]):
        obj = self.read(item_id)
        if not obj:
            return None

        for key, value in data.items():
            if hasattr(obj, key):
                setattr(obj, key, value)

        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete(self, item_id: int):
        obj = self.read(item_id)
        if not obj:
            return None

        self.db.delete(obj)
        self.db.commit()
        return True
