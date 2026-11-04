
from datetime import date, datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.models.improvement_action_model import (
    ImprovementPriority,
    ImprovementStatus,
)


class ImprovementActionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    indicator_id: int | None = Field(default=None, gt=0)

    gap_description: str = Field(
        min_length=1,
        max_length=2000,
    )

    description: str = Field(
        min_length=1,
        max_length=2000,
    )

    priority: ImprovementPriority = ImprovementPriority.MEDIUM

    responsible: str = Field(
        min_length=1,
        max_length=150,
    )

    target_date: date

    @field_validator(
        "gap_description",
        "description",
        "responsible",
    )
    @classmethod
    def validate_text_not_empty(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Field cannot be empty")

        return value


class ImprovementActionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    indicator_id: int | None = Field(default=None, gt=0)

    gap_description: str | None = Field(
        default=None,
        min_length=1,
        max_length=2000,
    )

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

    status: ImprovementStatus | None = None

    @field_validator(
        "gap_description",
        "description",
        "responsible",
    )
    @classmethod
    def validate_text_not_empty(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return value

        value = value.strip()

        if not value:
            raise ValueError("Field cannot be empty")

        return value

    @model_validator(mode="after")
    def validate_not_empty_update(self):
        if not self.model_fields_set:
            raise ValueError(
                "At least one field must be provided"
            )

        return self


class ImprovementActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    evaluation_id: int
    indicator_id: int | None

    gap_description: str
    description: str

    priority: ImprovementPriority
    responsible: str
    target_date: date

    status: ImprovementStatus

    created_at: datetime
    updated_at: datetime
