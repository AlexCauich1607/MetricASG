
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.ai_recommendation_request import (
    AIRecommendationConstraints,
    AIRecommendationRequest,
)
from app.models.evaluation_indicator_response_model import (
    EvaluationIndicatorResponse,
)
from app.models.evaluation_model import Evaluation
from app.models.indicator_answer_model import IndicatorAnswer
from app.models.ambit_model import Ambit
from app.models.indicator_model import Indicator
from app.models.maturity_level_model import MaturityLevel
from app.services.evaluations_service import EvaluationService
from app.services.improvement_action_service import (
    ImprovementActionService,
)

class AIRecommendationContextService:
    """Construye el contexto autorizado para recomendaciones ASG."""

    def __init__(self, db: Session):
        self.db = db

    def build_context(
        self,
        evaluation_id: int,
        user_id: int,
        constraints: AIRecommendationConstraints | None = None,
    ) -> AIRecommendationRequest:
        # Validar autorización y recuperar resultados oficiales.
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
                detail="Evaluation results are incomplete for AI recommendations",
            )

        # Obtener acciones existentes con autorización.
        actions = ImprovementActionService(self.db).list_actions(
            evaluation_id=evaluation_id,
            user_id=user_id,
        )

        # Recuperar únicamente los indicadores asociados a las brechas.
        indicator_ids = {
            action.indicator_id
            for action in actions
            if action.indicator_id is not None
        }

        indicators = {}
        responses = {}
        answers = {}
        maturity_levels = {}

        if indicator_ids:
            indicator_records = (
                self.db.query(Indicator)
                .join(Ambit, Indicator.ambit_id == Ambit.id)
                .filter(
                    Indicator.id.in_(indicator_ids),
                    Ambit.methodology_id == evaluation.methodology_id,
                )
                .all()
            )

            indicators = {
                indicator.id: indicator
                for indicator in indicator_records
            }

            response_records = (
                self.db.query(EvaluationIndicatorResponse)
                .filter(
                    EvaluationIndicatorResponse.evaluation_id
                    == evaluation_id,
                    EvaluationIndicatorResponse.indicator_id.in_(
                        indicator_ids
                    ),
                )
                .all()
            )

            responses = {
                response.indicator_id: response
                for response in response_records
            }

            answer_ids = {
                response.indicator_answer_id
                for response in response_records
                if response.indicator_answer_id is not None
            }

            if answer_ids:
                answer_records = (
                    self.db.query(IndicatorAnswer)
                    .filter(IndicatorAnswer.id.in_(answer_ids))
                    .all()
                )

                answers = {
                    answer.id: answer
                    for answer in answer_records
                }

            maturity_ids = {
                response.maturity_level_id
                for response in response_records
            }

            if maturity_ids:
                maturity_records = (
                    self.db.query(MaturityLevel)
                    .filter(
                        MaturityLevel.id.in_(maturity_ids),
                        MaturityLevel.methodology_id
                        == evaluation.methodology_id,
                    )
                    .all()
                )

                maturity_levels = {
                    maturity.id: maturity
                    for maturity in maturity_records
                }


        gaps = []

        for action in actions:
            indicator = indicators.get(action.indicator_id)
            response = responses.get(action.indicator_id)

            answer = (
                answers.get(response.indicator_answer_id)
                if response is not None
                else None
            )

            maturity = (
                maturity_levels.get(response.maturity_level_id)
                if response is not None
                else None
            )

            # Validar consistencia de las relaciones metodológicas.
            if action.indicator_id is not None:
                if (
                    indicator is None
                    or response is None
                    or maturity is None
                    or (
                        response.indicator_answer_id is not None
                        and answer is None
                    )
                    or (
                        answer is not None
                        and (
                            answer.indicator_id != action.indicator_id
                            or answer.maturity_level_id
                            != response.maturity_level_id
                        )
                    )
                ):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=(
                            "Inconsistent indicator methodology "
                            "for AI recommendations"
                        ),
                    )

            gaps.append({
                "indicator_id": action.indicator_id,
                "indicator_question": (
                    indicator.question if indicator else None
                ),
                "indicator_answer": (
                    answer.text if answer and answer.text else None
                ),
                "maturity_level": (
                    maturity.name if maturity else None
                ),
                "description": action.gap_description,
                "priority": action.priority.value,
            })

        return AIRecommendationRequest.model_validate({
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
            "gaps": gaps,
            "existing_actions": [
                {
                    "id": action.id,
                    "indicator_id": action.indicator_id,
                    "description": action.description,
                    "priority": action.priority.value,
                    "status": action.status.value,
                    "target_date": action.target_date,
                }
                for action in actions
            ],
            "constraints": (
                constraints.model_dump()
                if constraints is not None
                else {}
            ),
        })
