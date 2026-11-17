from fastapi import Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from ..controllers.base_controller import BaseController
from ..database.database import get_db
from ..models.evaluation_model import Evaluation
from ..services.evaluations_service import EvaluationService
from ..models.user_model import User
from ..services.token_service import get_current_user
from app.services.evidence_storage_service import EvidenceStorageService
from app.controllers.evidence_controller import get_evidence_storage_service

from app.core.config import settings
from app.services.ai_explanation_context_service import (
    AIExplanationContextService,
)
from app.services.ai_explanation_service import AIExplanationService
from app.services.llm_provider_factory import create_llm_provider

from app.core.company_permissions import require_company_role
from app.core.roles import CompanyRole

from app.services.ai_recommendation_context_service import (
    AIRecommendationContextService,
)
from app.services.ai_recommendation_service import (
    AIRecommendationService,
)
from app.services.ai_recommendation_validation_service import (
    AIRecommendationValidationService,
)
from app.services.ai_recommendation_persistence_service import (
    AIRecommendationPersistenceService,
)
from app.services.improvement_action_service import (
    ImprovementActionService,
)
from sqlalchemy import select

from app.models.ai_recommendation_model import AIRecommendation
from app.models.ai_recommendation_acceptance_request import (
    AIRecommendationAcceptanceRequest,
)
from app.services.ai_recommendation_review_service import (
    AIRecommendationReviewService,
)

class EvaluationResponseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    indicator_id: int
    indicator_answer_id: int


class EvaluationSubmitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    company_id: int | None = None
    responses: list[EvaluationResponseRequest]


class EvaluationsController(BaseController):

    model = Evaluation
    prefix = "evaluations"
    read_only_admin = True
    read_all_only_admin = True
    create_only_admin = True
    update_only_admin = True
    delete_only_admin = True

    def __init__(self):
        super().__init__()

        @self.router.get("/structure/all")
        def get_structure(db: Session = Depends(get_db)):
            return EvaluationService(db).get_structure()

        @self.router.post("/draft")
        def save_draft(
            payload: EvaluationSubmitRequest,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
            storage: EvidenceStorageService = Depends(
                get_evidence_storage_service
            ),
        ):
            return EvaluationService(db).save_draft(
                payload.model_dump(),
                current_user.id,
                storage=storage,
            )

        @self.router.get("/draft")
        def get_draft(
            company_id: int | None = None,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return EvaluationService(db).get_draft(
                user_id=current_user.id,
                company_id=company_id,
            )

        @self.router.post("/submit")
        def submit_evaluation(
            payload: EvaluationSubmitRequest,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db)
        ):
            return EvaluationService(db).submit_evaluation(
                payload.model_dump(),
                current_user.id
            )
        
        @self.router.get("/results/me")
        def get_latest_results(
            company_id: int | None = None,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return EvaluationService(db).get_latest_results(
                user_id=current_user.id,
                company_id=company_id,
            )

        @self.router.get("/{evaluation_id}/results")
        def get_results_by_id(
            evaluation_id: int,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return EvaluationService(db).get_results_by_id(
                evaluation_id=evaluation_id,
                user_id=current_user.id,
            )

        @self.router.post("/{evaluation_id}/ai-explanation")
        def generate_ai_explanation(
            evaluation_id: int,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            if not settings.ai_enabled:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="AI explanations are not available",
                )

            context = AIExplanationContextService(db).build_context(
                evaluation_id=evaluation_id,
                user_id=current_user.id,
            )

            try:
                provider = create_llm_provider(settings)
                explanation = AIExplanationService(
                    provider
                ).generate_explanation(context)
            except (RuntimeError, ValueError):
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="AI explanation generation is temporarily unavailable",
                ) from None

            return {
                "evaluation_id": evaluation_id,
                "explanation": explanation,
                "generated_by_ai": True,
            }


        @self.router.post("/{evaluation_id}/ai-recommendations")
        def generate_ai_recommendations(
            evaluation_id: int,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            if not settings.ai_enabled:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="AI recommendations are not available",
                )

            # Validar la evaluación y los permisos antes de
            # realizar una llamada al proveedor de IA.
            action_service = ImprovementActionService(db)

            evaluation = action_service.get_evaluation_or_error(
                evaluation_id=evaluation_id,
                user_id=current_user.id,
            )

            require_company_role(
                db,
                current_user,
                evaluation.company_id,
                CompanyRole.COMPANY_ADMIN,
                CompanyRole.ASG_MANAGER,
            )

            action_service.validate_evaluation_completed(evaluation)

            # Construir el contexto exclusivamente desde el backend.
            context = AIRecommendationContextService(
                db
            ).build_context(
                evaluation_id=evaluation_id,
                user_id=current_user.id,
            )

            # Invocar el proveedor de IA.
            try:
                provider = create_llm_provider(settings)

                raw_response = AIRecommendationService(
                    provider
                ).generate_recommendations(context)

            except (RuntimeError, ValueError):
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=(
                        "AI recommendation generation "
                        "is temporarily unavailable"
                    ),
                ) from None

            # Validar el JSON y su correspondencia con
            # las brechas registradas en el contexto.
            validated_response = (
                AIRecommendationValidationService().validate(
                    raw_response=raw_response,
                    context=context,
                )
            )

            # Guardar las propuestas sin crear acciones de mejora.
            saved = AIRecommendationPersistenceService(
                db
            ).save_recommendations(
                evaluation_id=evaluation_id,
                user_id=current_user.id,
                context=context,
                response=validated_response,
            )

            return {
                "evaluation_id": evaluation_id,
                "generated_by_ai": True,
                "requires_human_approval": True,
                "recommendations": [
                    {
                        "id": recommendation.id,
                        "indicator_id": recommendation.indicator_id,
                        "gap_description": (
                            recommendation.gap_description
                        ),
                        "title": recommendation.title,
                        "description": recommendation.description,
                        "justification": recommendation.justification,
                        "priority": recommendation.priority.value,
                        "status": recommendation.status.value,
                    }
                    for recommendation in saved
                ],
            }


        @self.router.post("/{evaluation_id}/ai-recommendations/review")
        def review_ai_recommendation(
            evaluation_id: int,
            payload: AIRecommendationAcceptanceRequest,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            recommendation = AIRecommendationReviewService(
                db
            ).review(
                evaluation_id=evaluation_id,
                user_id=current_user.id,
                payload=payload,
            )

            return {
                "evaluation_id": evaluation_id,
                "recommendation": {
                    "id": recommendation.id,
                    "status": recommendation.status.value,
                    "reviewed_by": recommendation.reviewed_by,
                    "reviewed_at": recommendation.reviewed_at,
                    "improvement_action_id": (
                        recommendation.improvement_action_id
                    ),
                },
            }


        @self.router.get("/{evaluation_id}/ai-recommendations")
        def list_ai_recommendations(
            evaluation_id: int,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            action_service = ImprovementActionService(db)

            evaluation = action_service.get_evaluation_or_error(
                evaluation_id=evaluation_id,
                user_id=current_user.id,
            )

            require_company_role(
                db,
                current_user,
                evaluation.company_id,
                CompanyRole.COMPANY_ADMIN,
                CompanyRole.ASG_MANAGER,
            )

            recommendations = db.execute(
                select(AIRecommendation)
                .where(
                    AIRecommendation.evaluation_id == evaluation_id
                )
                .order_by(AIRecommendation.id.asc())
            ).scalars().all()

            return {
                "evaluation_id": evaluation_id,
                "recommendations": [
                    {
                        "id": recommendation.id,
                        "indicator_id": recommendation.indicator_id,
                        "gap_description": recommendation.gap_description,
                        "title": recommendation.title,
                        "description": recommendation.description,
                        "justification": recommendation.justification,
                        "priority": recommendation.priority.value,
                        "status": recommendation.status.value,
                        "reviewed_by": recommendation.reviewed_by,
                        "reviewed_at": recommendation.reviewed_at,
                        "improvement_action_id": (
                            recommendation.improvement_action_id
                        ),
                    }
                    for recommendation in recommendations
                ],
            }

        @self.router.get("/history/me")
        def get_history(
            company_id: int | None = None,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return EvaluationService(db).get_evaluation_history(
                user_id=current_user.id,
                company_id=company_id,
            )

        @self.router.get("/dashboard/history/me")
        def get_historical_dashboard(
            company_id: int | None = None,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return EvaluationService(db).get_historical_dashboard(
                user_id=current_user.id,
                company_id=company_id,
            )

        @self.router.get("/compare")
        def compare_evaluations(
            evaluation_id_1: int,
            evaluation_id_2: int,
            company_id: int | None = None,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return EvaluationService(db).get_comparison(
                evaluation_id_1=evaluation_id_1,
                evaluation_id_2=evaluation_id_2,
                user_id=current_user.id,
                company_id=company_id,
            )

                # Register specific GET routes before the inherited dynamic route.
        dynamic_route = next(
            route
            for route in self.router.routes
            if route.path == "/api/evaluations/{item_id}"
            and "GET" in route.methods
        )

        self.router.routes.remove(dynamic_route)
        self.router.routes.append(dynamic_route)