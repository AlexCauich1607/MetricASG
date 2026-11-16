
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.ai_explanation_request import AIExplanationRequest
from app.models.evaluation_model import Evaluation
from app.services.evaluations_service import EvaluationService
from app.services.improvement_action_service import ImprovementActionService


class AIExplanationContextService:
    """Construye el contexto autorizado para generar explicaciones ASG."""

    def __init__(self, db: Session):
        self.db = db

    def build_context(
        self,
        evaluation_id: int,
        user_id: int,
    ) -> AIExplanationRequest:
        # Primero se comprueban los permisos y el estado de la evaluación.
        results = EvaluationService(self.db).get_results_by_id(
            evaluation_id=evaluation_id,
            user_id=user_id,
        )

        evaluation = self.db.get(Evaluation, evaluation_id)

        if (
            evaluation is None
            or evaluation.methodology is None
            or results["global_score"] is None
            or not results["global_maturity_level"]
            or not results["ambits"]
            or any(
                ambit["score"] is None
                or not ambit["maturity_level"]
                for ambit in results["ambits"]
            )
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Evaluation results are incomplete for AI explanation",
            )

        actions = ImprovementActionService(self.db).list_actions(
            evaluation_id=evaluation_id,
            user_id=user_id,
        )

        return AIExplanationRequest.model_validate({
            "evaluation": {
                "id": evaluation.id,
                "date": evaluation.date,
                "methodology": {
                    "id": evaluation.methodology.id,
                    "name": evaluation.methodology.name,
                    "version": evaluation.methodology.version,
                },
            },
            "global_result": {
                "score": results["global_score"],
                "maturity_level": results["global_maturity_level"],
            },
            "ambits": [
                {
                    "id": ambit["ambit_id"],
                    "name": ambit["ambit_name"],
                    "score": ambit["score"],
                    "maturity_level": ambit["maturity_level"],
                    "feedback": ambit["feedback"],
                }
                for ambit in results["ambits"]
            ],
            "gaps": [
                {
                    "indicator_id": action.indicator_id,
                    "description": action.gap_description,
                    "priority": action.priority.value,
                }
                for action in actions
            ],
        })
