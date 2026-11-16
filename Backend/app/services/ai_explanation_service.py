
from app.models.ai_explanation_request import AIExplanationRequest
from app.services.ai_explanation_prompt import (
    AI_EXPLANATION_SYSTEM_PROMPT,
)
from app.services.llm_provider import LLMProvider


class AIExplanationService:
    """Coordina la generación de explicaciones mediante un proveedor LLM."""

    def __init__(self, provider: LLMProvider):
        self.provider = provider

    def generate_explanation(
        self,
        request: AIExplanationRequest,
    ) -> str:
        """Genera una explicación sin modificar los datos oficiales."""

        user_prompt = request.model_dump_json()

        return self.provider.generate(
            system_prompt=AI_EXPLANATION_SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )
