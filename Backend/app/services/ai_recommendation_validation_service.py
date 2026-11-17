
import json

from fastapi import HTTPException, status
from pydantic import ValidationError

from app.models.ai_recommendation_request import (
    AIRecommendationRequest,
)
from app.models.ai_recommendation_response import (
    AIRecommendationResponse,
)


class AIRecommendationValidationService:
    """Valida las recomendaciones generadas contra el contexto ASG."""

    def validate(
        self,
        raw_response: str,
        context: AIRecommendationRequest,
    ) -> AIRecommendationResponse:
        try:
            payload = json.loads(raw_response)

            if (
                not isinstance(payload, dict)
                or "recommendations" not in payload
            ):
                raise ValueError("Missing recommendations")

            response = AIRecommendationResponse.model_validate(
                payload
            )

        except (ValueError, TypeError, ValidationError):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid AI recommendation response",
            ) from None

        allowed_gaps = {
            (
                gap.indicator_id,
                gap.description,
                gap.priority,
            )
            for gap in context.gaps
        }

        seen_recommendations = set()

        for recommendation in response.recommendations:
            gap_key = (
                recommendation.indicator_id,
                recommendation.gap_description,
                recommendation.priority,
            )

            if gap_key not in allowed_gaps:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=(
                        "AI recommendation does not match "
                        "an authorized evaluation gap"
                    ),
                )

            recommendation_key = (
                recommendation.indicator_id,
                recommendation.gap_description,
                recommendation.title.strip().casefold(),
                recommendation.description.strip().casefold(),
            )

            if recommendation_key in seen_recommendations:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Duplicate AI recommendation",
                )

            seen_recommendations.add(recommendation_key)


        if not context.gaps and response.recommendations:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "AI recommendations require "
                    "registered evaluation gaps"
                ),
            )

        return response
