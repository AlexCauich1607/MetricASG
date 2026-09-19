from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Enum as SqlEnum,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database.database import Base

class EvaluationStatus(str, PyEnum):
    DRAFT = "DRAFT"
    COMPLETED = "COMPLETED"
class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, autoincrement=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    date = Column(DateTime, server_default=func.now())
    global_score = Column(Float)
    description = Column(Text)
    status = Column(
        SqlEnum(
            EvaluationStatus,
            name="evaluation_status",
            native_enum=False,
            create_constraint=True,
            validate_strings=True
        ),
        nullable=False,
        default=EvaluationStatus.COMPLETED,
        server_default=EvaluationStatus.COMPLETED.value
    )

    ambit_scores = relationship(
        "EvaluationAmbitScore",
        cascade="all, delete",
        passive_deletes=True
    )

    indicator_responses = relationship(
        "EvaluationIndicatorResponse",
        cascade="all, delete",
        passive_deletes=True
    )

