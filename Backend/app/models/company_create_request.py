from pydantic import BaseModel, ConfigDict, Field


class CompanyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    sector_id: int | None = Field(default=None, gt=0)
    size_id: int | None = Field(default=None, gt=0)


class CompanyCreateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sector_id: int | None
    size_id: int | None
    active: bool
