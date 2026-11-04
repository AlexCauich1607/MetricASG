
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.improvement_action_request import (
    ImprovementActionCreate,
    ImprovementActionResponse,
    ImprovementActionUpdate,
)

from app.models.user_model import User
from app.services.improvement_action_service import (
    ImprovementActionService,
)
from app.services.token_service import get_current_user
from app.models.improvement_progress_response import (
    ImprovementProgressResponse,
)

class ImprovementActionController:
    def __init__(self):
        self.router = APIRouter(
            prefix="/api/evaluations/{evaluation_id}/improvement-actions",
            tags=["Improvement Actions"],
        )

        @self.router.post(
            "",
            response_model=ImprovementActionResponse,
            status_code=status.HTTP_201_CREATED,
        )
        def create_action(
            evaluation_id: int,
            payload: ImprovementActionCreate,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return ImprovementActionService(db).create_action(
                evaluation_id=evaluation_id,
                user_id=current_user.id,
                payload=payload,
            )

        @self.router.get(
            "",
            response_model=list[ImprovementActionResponse],
        )
        def list_actions(
            evaluation_id: int,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return ImprovementActionService(db).list_actions(
                evaluation_id=evaluation_id,
                user_id=current_user.id,
            )

        @self.router.get(
            "/progress",
            response_model=ImprovementProgressResponse,
        )
        def get_progress(
            evaluation_id: int,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return ImprovementActionService(db).get_progress_metrics(
                evaluation_id=evaluation_id,
                user_id=current_user.id,
            )

        @self.router.get(
            "/{action_id}",
            response_model=ImprovementActionResponse,
        )
        def get_action(
            evaluation_id: int,
            action_id: int,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return ImprovementActionService(db).get_action_or_error(
                evaluation_id=evaluation_id,
                action_id=action_id,
                user_id=current_user.id,
            )

        @self.router.patch(
            "/{action_id}",
            response_model=ImprovementActionResponse,
        )
        def update_action(
            evaluation_id: int,
            action_id: int,
            payload: ImprovementActionUpdate,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return ImprovementActionService(db).update_action(
                evaluation_id=evaluation_id,
                action_id=action_id,
                user_id=current_user.id,
                payload=payload,
            )

        @self.router.delete(
            "/{action_id}",
            status_code=status.HTTP_204_NO_CONTENT,
        )
        def delete_action(
            evaluation_id: int,
            action_id: int,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            ImprovementActionService(db).delete_action(
                evaluation_id=evaluation_id,
                action_id=action_id,
                user_id=current_user.id,
            )
