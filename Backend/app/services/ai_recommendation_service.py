
from app.models.ai_recommendation_request import (
    AIRecommendationRequest,
)
from app.services.ai_recommendation_prompt import (
    AI_RECOMMENDATION_SYSTEM_PROMPT,
)
from app.services.llm_provider import LLMProvider


class AIRecommendationService:
    """Coordina la generación de recomendaciones mediante un LLM."""

    def __init__(self, provider: LLMProvider):
        self.provider = provider

    def generate_recommendations(
        self,
        request: AIRecommendationRequest,
    ) -> str:
        """Solicita propuestas sin modificar los resultados oficiales."""

        user_prompt = request.model_dump_json()

        return self.provider.generate(
            system_prompt=AI_RECOMMENDATION_SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )
