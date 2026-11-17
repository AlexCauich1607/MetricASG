
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.company_permissions import require_company_role
from app.core.roles import CompanyRole
from app.models.ai_recommendation_acceptance_request import (
    AIRecommendationAcceptanceRequest,
)
from app.models.ai_recommendation_model import (
    AIRecommendation,
    AIRecommendationStatus,
)
from app.models.improvement_action_request import ImprovementActionCreate
from app.models.user_model import User
from app.services.audit_service import AuditService
from app.services.improvement_action_service import ImprovementActionService


class AIRecommendationReviewService:
    """Procesa decisiones humanas sobre recomendaciones de IA."""

    def __init__(self, db: Session):
        self.db = db

    def review(
        self,
        *,
        evaluation_id: int,
        user_id: int,
        payload: AIRecommendationAcceptanceRequest,
    ) -> AIRecommendation:
        try:
            action_service = ImprovementActionService(self.db)

            evaluation = action_service.get_evaluation_or_error(
                evaluation_id=evaluation_id,
                user_id=user_id,
            )

            user = self.db.get(User, user_id)

            require_company_role(
                self.db,
                user,
                evaluation.company_id,
                CompanyRole.COMPANY_ADMIN,
                CompanyRole.ASG_MANAGER,
            )

            action_service.validate_evaluation_completed(evaluation)

            recommendation = (
                self.db.query(AIRecommendation)
                .filter(
                    AIRecommendation.id == payload.recommendation_id,
                    AIRecommendation.evaluation_id == evaluation_id,
                )
                .with_for_update()
                .first()
            )

            if recommendation is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="AI recommendation not found",
                )

            if recommendation.status != AIRecommendationStatus.PENDING:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="AI recommendation already reviewed",
                )
            human_edits = {}
            if payload.decision == "ACCEPT":
                action_payload = ImprovementActionCreate(
                    indicator_id=recommendation.indicator_id,
                    gap_description=recommendation.gap_description,
                    description=(
                        payload.description
                        if payload.description is not None
                        else recommendation.description
                    ),
                    priority=(
                        payload.priority
                        if payload.priority is not None
                        else recommendation.priority
                    ),
                    responsible=payload.responsible,
                    target_date=payload.target_date,
                )

                action = action_service.create_action(
                    evaluation_id=evaluation_id,
                    user_id=user_id,
                    payload=action_payload,
                    commit=False,
                )
                if action.description != recommendation.description:
                    human_edits["description"] = {
                        "original": recommendation.description,
                        "accepted": action.description,
                    }

                if action.priority != recommendation.priority:
                    human_edits["priority"] = {
                        "original": recommendation.priority.value,
                        "accepted": action.priority.value,
                    }
                recommendation.status = AIRecommendationStatus.ACCEPTED
                recommendation.improvement_action_id = action.id

            else:
                recommendation.status = AIRecommendationStatus.REJECTED

            recommendation.reviewed_by = user_id
            recommendation.reviewed_at = datetime.now(timezone.utc)

            AuditService.record(
                db=self.db,
                action="ai_recommendation.reviewed",
                resource_type="ai_recommendation",
                resource_id=recommendation.id,
                actor_id=user_id,
                company_id=evaluation.company_id,
                context={
                    "evaluation_id": evaluation_id,
                    "decision": payload.decision,
                    "improvement_action_id": recommendation.improvement_action_id,
                    "human_edits": human_edits,
                },
            )

            self.db.commit()
            self.db.refresh(recommendation)

            return recommendation

        except HTTPException:
            self.db.rollback()
            raise

        except SQLAlchemyError:
            self.db.rollback()
            raise
