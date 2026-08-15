from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    Float,
    ForeignKey
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database.database import Base

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

