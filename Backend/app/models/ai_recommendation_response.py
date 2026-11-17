
from pydantic import BaseModel, ConfigDict, Field


class AIRecommendationProposal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    indicator_id: int | None = Field(default=None, gt=0)
    gap_description: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    justification: str = Field(min_length=1)
    priority: str = Field(pattern="^(LOW|MEDIUM|HIGH)$")


class AIRecommendationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recommendations: list[AIRecommendationProposal] = Field(
        default_factory=list
    )
