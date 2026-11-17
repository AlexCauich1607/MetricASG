
from datetime import date

from pydantic import BaseModel, Field

from app.models.ai_explanation_request import (
    AIExplanationAmbitResult,
    AIExplanationEvaluation,
    AIExplanationGlobalResult,
)


class AIRecommendationGap(BaseModel):
    indicator_id: int | None = Field(default=None, gt=0)
    indicator_question: str | None = None
    indicator_answer: str | None = None
    maturity_level: str | None = None
    description: str = Field(min_length=1)
    priority: str = Field(pattern="^(LOW|MEDIUM|HIGH)$")


class AIRecommendationExistingAction(BaseModel):
    id: int = Field(gt=0)
    indicator_id: int | None = Field(default=None, gt=0)
    description: str = Field(min_length=1)
    priority: str = Field(pattern="^(LOW|MEDIUM|HIGH)$")
    status: str = Field(
        pattern="^(PENDING|IN_PROGRESS|COMPLETED|CANCELLED)$"
    )
    target_date: date


class AIRecommendationConstraints(BaseModel):
    budget: str | None = None
    resources: str | None = None
    additional_context: str | None = None


class AIRecommendationRequest(BaseModel):
    evaluation: AIExplanationEvaluation
    global_result: AIExplanationGlobalResult
    ambits: list[AIExplanationAmbitResult] = Field(min_length=1)
    gaps: list[AIRecommendationGap] = Field(default_factory=list)
    existing_actions: list[AIRecommendationExistingAction] = Field(
        default_factory=list
    )
    constraints: AIRecommendationConstraints = Field(
        default_factory=AIRecommendationConstraints
    )
