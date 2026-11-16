
from datetime import datetime

from pydantic import BaseModel, Field


class AIExplanationMethodology(BaseModel):
    id: int = Field(gt=0)
    name: str = Field(min_length=1)
    version: str = Field(min_length=1)


class AIExplanationEvaluation(BaseModel):
    id: int = Field(gt=0)
    date: datetime
    methodology: AIExplanationMethodology


class AIExplanationGlobalResult(BaseModel):
    score: float = Field(allow_inf_nan=False)
    maturity_level: str = Field(min_length=1)


class AIExplanationAmbitResult(BaseModel):
    id: int = Field(gt=0)
    name: str = Field(min_length=1)
    score: float = Field(allow_inf_nan=False)
    maturity_level: str = Field(min_length=1)
    feedback: str | None = None


class AIExplanationGap(BaseModel):
    indicator_id: int | None = Field(default=None, gt=0)
    description: str = Field(min_length=1)
    priority: str = Field(pattern="^(LOW|MEDIUM|HIGH)$")


class AIExplanationRequest(BaseModel):
    evaluation: AIExplanationEvaluation
    global_result: AIExplanationGlobalResult
    ambits: list[AIExplanationAmbitResult] = Field(min_length=1)
    gaps: list[AIExplanationGap] = Field(default_factory=list)
