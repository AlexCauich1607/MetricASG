from pydantic import BaseModel, Field


class ImprovementProgressResponse(BaseModel):
    evaluation_id: int = Field(gt=0)

    total: int = Field(ge=0)
    pending: int = Field(ge=0)
    in_progress: int = Field(ge=0)
    completed: int = Field(ge=0)
    cancelled: int = Field(ge=0)

    progress_percentage: float = Field(ge=0, le=100)
