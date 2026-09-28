from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.services.methodology_service import MethodologyService
from app.services.token_service import get_current_user, require_admin


class MethodologiesController:
    def __init__(self):
        self.router = APIRouter(
            prefix="/api/methodologies",
            tags=["Methodologies"],
            dependencies=[Depends(get_current_user)],
        )

        @self.router.get("/")
        def read_all(db: Session = Depends(get_db)):
            return MethodologyService(db).read_all()

        @self.router.get("/{methodology_id}")
        def read(
            methodology_id: int,
            db: Session = Depends(get_db),
        ):
            methodology = MethodologyService(db).read(methodology_id)

            if not methodology:
                raise HTTPException(
                    status_code=404,
                    detail="Methodology not found",
                )

            return methodology

        @self.router.post(
            "/",
            dependencies=[Depends(require_admin)],
        )
        def create(
            data: Dict[str, Any],
            db: Session = Depends(get_db),
        ):
            return MethodologyService(db).create(data)

        @self.router.put(
            "/{methodology_id}",
            dependencies=[Depends(require_admin)],
        )
        def update(
            methodology_id: int,
            data: Dict[str, Any],
            db: Session = Depends(get_db),
        ):
            return MethodologyService(db).update(
                methodology_id,
                data,
            )

        @self.router.post(
            "/{methodology_id}/publish",
            dependencies=[Depends(require_admin)],
        )
        def publish(
            methodology_id: int,
            db: Session = Depends(get_db),
        ):
            return MethodologyService(db).publish(methodology_id)

        @self.router.post(
            "/{methodology_id}/activate",
            dependencies=[Depends(require_admin)],
        )
        def activate(
            methodology_id: int,
            db: Session = Depends(get_db),
        ):
            return MethodologyService(db).activate(methodology_id)

        @self.router.post(
            "/{methodology_id}/archive",
            dependencies=[Depends(require_admin)],
        )
        def archive(
            methodology_id: int,
            db: Session = Depends(get_db),
        ):
            return MethodologyService(db).archive(methodology_id)