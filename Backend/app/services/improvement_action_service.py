
from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.ambit_model import Ambit
from app.models.evaluation_indicator_response_model import (
    EvaluationIndicatorResponse,
)
from app.models.evaluation_model import (
    Evaluation,
    EvaluationStatus,
)
from app.models.improvement_action_model import (
    ImprovementAction,
    ImprovementStatus,
)
from app.models.improvement_action_request import (
    ImprovementActionCreate,
    ImprovementActionUpdate,
)
from app.models.indicator_model import Indicator

class ImprovementActionService:
    def __init__(self, db: Session):
        self.db = db

    def get_evaluation_or_error(
        self,
        evaluation_id: int,
        user_id: int,
    ) -> Evaluation:
        evaluation = (
            self.db.query(Evaluation)
            .filter(
                Evaluation.id == evaluation_id,
                Evaluation.user_id == user_id,
            )
            .first()
        )

        if evaluation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Evaluation not found",
            )

        return evaluation

    def validate_evaluation_completed(
        self,
        evaluation: Evaluation,
    ) -> None:
        if evaluation.status != EvaluationStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Improvement actions require a completed evaluation",
            )

    def validate_indicator_response(
        self,
        evaluation: Evaluation,
        indicator_id: int | None,
    ) -> None:
        if indicator_id is None:
            return

        indicator = (
            self.db.query(Indicator)
            .join(Ambit, Indicator.ambit_id == Ambit.id)
            .filter(
                Indicator.id == indicator_id,
                Ambit.methodology_id == evaluation.methodology_id,
            )
            .first()
        )

        if indicator is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Indicator does not belong to evaluation methodology",
            )

        response = (
            self.db.query(EvaluationIndicatorResponse)
            .filter(
                EvaluationIndicatorResponse.evaluation_id == evaluation.id,
                EvaluationIndicatorResponse.indicator_id == indicator_id,
            )
            .first()
        )

        if response is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Indicator has no saved response in this evaluation",
            )


    def create_action(
        self,
        evaluation_id: int,
        user_id: int,
        payload: ImprovementActionCreate,
    ) -> ImprovementAction:
        try:
            evaluation = (
                self.db.query(Evaluation)
                .filter(
                    Evaluation.id == evaluation_id,
                    Evaluation.user_id == user_id,
                )
                .with_for_update()
                .first()
            )

            if evaluation is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Evaluation not found",
                )

            self.validate_evaluation_completed(evaluation)

            self.validate_indicator_response(
                evaluation,
                payload.indicator_id,
            )

            action = ImprovementAction(
                evaluation_id=evaluation.id,
                indicator_id=payload.indicator_id,
                gap_description=payload.gap_description,
                description=payload.description,
                priority=payload.priority,
                responsible=payload.responsible,
                target_date=payload.target_date,
            )

            self.db.add(action)
            self.db.commit()
            self.db.refresh(action)

            return action

        except HTTPException:
            self.db.rollback()
            raise

        except SQLAlchemyError:
            self.db.rollback()
            raise


    def list_actions(
        self,
        evaluation_id: int,
        user_id: int,
    ) -> list[ImprovementAction]:
        self.get_evaluation_or_error(
            evaluation_id=evaluation_id,
            user_id=user_id,
        )

        return (
            self.db.query(ImprovementAction)
            .filter(
                ImprovementAction.evaluation_id == evaluation_id,
            )
            .order_by(
                ImprovementAction.created_at.asc(),
                ImprovementAction.id.asc(),
            )
            .all()
        )


    def get_action_or_error(
        self,
        evaluation_id: int,
        action_id: int,
        user_id: int,
    ) -> ImprovementAction:
        self.get_evaluation_or_error(
            evaluation_id=evaluation_id,
            user_id=user_id,
        )

        action = (
            self.db.query(ImprovementAction)
            .filter(
                ImprovementAction.id == action_id,
                ImprovementAction.evaluation_id == evaluation_id,
            )
            .first()
        )

        if action is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Improvement action not found",
            )

        return action


    def update_action(
        self,
        evaluation_id: int,
        action_id: int,
        user_id: int,
        payload: ImprovementActionUpdate,
    ) -> ImprovementAction:
        try:
            evaluation = (
                self.db.query(Evaluation)
                .filter(
                    Evaluation.id == evaluation_id,
                    Evaluation.user_id == user_id,
                )
                .with_for_update()
                .first()
            )

            if evaluation is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Evaluation not found",
                )

            self.validate_evaluation_completed(evaluation)

            action = (
                self.db.query(ImprovementAction)
                .filter(
                    ImprovementAction.id == action_id,
                    ImprovementAction.evaluation_id == evaluation.id,
                )
                .first()
            )

            if action is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Improvement action not found",
                )

            changes = payload.model_dump(exclude_unset=True)

            if not changes:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="At least one field must be provided",
                )

            required_fields = {
                "gap_description",
                "description",
                "priority",
                "responsible",
                "target_date",
                "status",
            }

            if any(
                field in changes and changes[field] is None
                for field in required_fields
            ):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Required fields cannot be null",
                )

            if "indicator_id" in changes:
                self.validate_indicator_response(
                    evaluation,
                    changes["indicator_id"],
                )

            for field, value in changes.items():
                setattr(action, field, value)

            self.db.commit()
            self.db.refresh(action)

            return action

        except HTTPException:
            self.db.rollback()
            raise

        except SQLAlchemyError:
            self.db.rollback()
            raise


    def delete_action(
        self,
        evaluation_id: int,
        action_id: int,
        user_id: int,
    ) -> None:
        try:
            evaluation = (
                self.db.query(Evaluation)
                .filter(
                    Evaluation.id == evaluation_id,
                    Evaluation.user_id == user_id,
                )
                .with_for_update()
                .first()
            )

            if evaluation is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Evaluation not found",
                )

            action = (
                self.db.query(ImprovementAction)
                .filter(
                    ImprovementAction.id == action_id,
                    ImprovementAction.evaluation_id == evaluation.id,
                )
                .first()
            )

            if action is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Improvement action not found",
                )

            self.db.delete(action)
            self.db.commit()

        except HTTPException:
            self.db.rollback()
            raise

        except SQLAlchemyError:
            self.db.rollback()
            raise



    def get_progress_metrics(
        self,
        evaluation_id: int,
        user_id: int,
    ) -> dict:
        actions = self.list_actions(
            evaluation_id=evaluation_id,
            user_id=user_id,
        )

        total = len(actions)

        pending = sum(
            action.status == ImprovementStatus.PENDING
            for action in actions
        )

        in_progress = sum(
            action.status == ImprovementStatus.IN_PROGRESS
            for action in actions
        )

        completed = sum(
            action.status == ImprovementStatus.COMPLETED
            for action in actions
        )

        cancelled = sum(
            action.status == ImprovementStatus.CANCELLED
            for action in actions
        )

        active_total = total - cancelled

        progress_percentage = (
            round(completed / active_total * 100, 2)
            if active_total > 0
            else 0.0
        )

        return {
            "evaluation_id": evaluation_id,
            "total": total,
            "pending": pending,
            "in_progress": in_progress,
            "completed": completed,
            "cancelled": cancelled,
            "progress_percentage": progress_percentage,
        }
