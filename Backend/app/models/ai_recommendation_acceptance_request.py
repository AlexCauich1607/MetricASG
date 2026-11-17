
from datetime import date
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.models.improvement_action_model import ImprovementPriority

class AIRecommendationAcceptanceRequest(BaseModel):
    """Datos proporcionados durante la revisión humana."""

    model_config = ConfigDict(extra="forbid")

    decision: Literal["ACCEPT", "REJECT"]

    recommendation_id: int = Field(gt=0)

    description: str | None = Field(
        default=None,
        min_length=1,
        max_length=2000,
    )

    priority: ImprovementPriority | None = None

    responsible: str | None = Field(
        default=None,
        min_length=1,
        max_length=150,
    )

    target_date: date | None = None

    @field_validator("description", "responsible")
    @classmethod
    def validate_text_not_empty(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        value = value.strip()

        if not value:
            raise ValueError("Field cannot be empty")

        return value


    @model_validator(mode="after")
    def validate_decision_fields(self):
        if self.decision == "ACCEPT":
            if self.responsible is None:
                raise ValueError(
                    "Responsible is required when accepting a recommendation"
                )

            if self.target_date is None:
                raise ValueError(
                    "Target date is required when accepting a recommendation"
                )

        if self.decision == "REJECT":
            editable_fields = (
                self.description,
                self.priority,
                self.responsible,
                self.target_date,
            )

            if any(value is not None for value in editable_fields):
                raise ValueError(
                    "Rejected recommendations cannot include action fields"
                )

        return self
