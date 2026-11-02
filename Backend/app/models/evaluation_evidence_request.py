from datetime import datetime
from enum import Enum
from urllib.parse import urlsplit

from app.models.evaluation_evidence_model import EvidenceType


from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


class TextEvidenceType(str, Enum):
    COMMENT = "COMMENT"
    URL = "URL"


class EvidenceCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    indicator_id: int = Field(gt=0)

    type: TextEvidenceType

    content: str = Field(
        min_length=1,
        max_length=2048,
    )

    @field_validator("content")
    @classmethod
    def validate_content_not_empty(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Evidence content cannot be empty")

        return value

    @model_validator(mode="after")
    def validate_content_by_type(self):
        if self.type == TextEvidenceType.COMMENT:
            if len(self.content) > 2000:
                raise ValueError(
                    "Comment cannot exceed 2000 characters"
                )

        elif self.type == TextEvidenceType.URL:
            url = urlsplit(self.content)

            if (
                url.scheme != "https"
                or not url.hostname
                or url.username is not None
                or url.password is not None
                or any(character.isspace() for character in self.content)
            ):
                raise ValueError(
                    "Evidence URL must be a valid HTTPS URL"
                )

            try:
                port = url.port
            except ValueError as exc:
                raise ValueError(
                    "Evidence URL has an invalid port"
                ) from exc

            if port is not None and not (1 <= port <= 65535):
                raise ValueError(
                    "Evidence URL has an invalid port"
                )

        return self




class EvidenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    evaluation_id: int
    indicator_id: int
    type: EvidenceType
    content: str | None = None

    original_filename: str | None = None
    mime_type: str | None = None
    file_size: int | None = None

    created_at: datetime
    updated_at: datetime

