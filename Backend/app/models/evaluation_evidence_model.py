from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database.database import Base


class EvidenceType(str, PyEnum):
    FILE = "FILE"
    URL = "URL"
    COMMENT = "COMMENT"


class EvaluationEvidence(Base):
    __tablename__ = "evaluation_evidences"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    evaluation_id = Column(
        Integer,
        ForeignKey("evaluations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    indicator_id = Column(
        Integer,
        ForeignKey("indicators.id", ondelete="RESTRICT"),
        nullable=False,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    type = Column(
        SqlEnum(
            EvidenceType,
            name="evaluation_evidence_type",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
    )

    content = Column(Text, nullable=True)

    storage_key = Column(String(255), nullable=True)
    original_filename = Column(String(255), nullable=True)
    mime_type = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    evaluation = relationship(
        "Evaluation",
        back_populates="evidences",
    )

    indicator = relationship(
        "Indicator",
        back_populates="evidences",
    )

    user = relationship(
        "User",
        back_populates="evidences",
    )
