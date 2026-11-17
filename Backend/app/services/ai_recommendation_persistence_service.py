from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.ai_recommendation_model import AIRecommendation
from app.models.ai_recommendation_request import AIRecommendationRequest
from app.models.ai_recommendation_response import AIRecommendationResponse
from app.services.improvement_action_service import ImprovementActionService
from app.services.ai_recommendation_validation_service import (
    AIRecommendationValidationService,
)
from app.services.audit_service import AuditService
from app.models.improvement_action_model import ImprovementPriority

class AIRecommendationPersistenceService:
    """Almacena propuestas validadas pendientes de revisión."""

    def __init__(self, db: Session):
        self.db = db

    def save_recommendations(
        self,
        *,
        evaluation_id: int,
        user_id: int,
        context: AIRecommendationRequest,
        response: AIRecommendationResponse,
    ) -> list[AIRecommendation]:

        if context.evaluation.id != evaluation_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Evaluation context mismatch",
            )

        action_service = ImprovementActionService(self.db)

        evaluation = action_service.get_evaluation_or_error(
            evaluation_id=evaluation_id,
            user_id=user_id,
        )

        action_service.validate_evaluation_completed(evaluation)

        validated_response = AIRecommendationValidationService().validate(
            raw_response=response.model_dump_json(),
            context=context,
        )

        saved = []

        try:
            for proposal in validated_response.recommendations:
                recommendation = AIRecommendation(
                    evaluation_id=evaluation_id,
                    indicator_id=proposal.indicator_id,
                    gap_description=proposal.gap_description,
                    title=proposal.title,
                    description=proposal.description,
                    justification=proposal.justification,
                    priority=ImprovementPriority(proposal.priority),
                )

                self.db.add(recommendation)
                saved.append(recommendation)

            self.db.flush()

            for recommendation in saved:
                AuditService.record(
                    db=self.db,
                    action="ai_recommendation.generated",
                    resource_type="ai_recommendation",
                    resource_id=recommendation.id,
                    actor_id=user_id,
                    company_id=evaluation.company_id,
                    context={
                        "evaluation_id": evaluation_id,
                        "indicator_id": recommendation.indicator_id,
                        "gap_description": recommendation.gap_description,
                        "title": recommendation.title,
                        "description": recommendation.description,
                        "justification": recommendation.justification,
                        "priority": recommendation.priority.value,
                        "status": recommendation.status.value,
                    },
                )

            self.db.commit()

            for recommendation in saved:
                self.db.refresh(recommendation)

            return saved

        except SQLAlchemyError:
            self.db.rollback()
            raise
