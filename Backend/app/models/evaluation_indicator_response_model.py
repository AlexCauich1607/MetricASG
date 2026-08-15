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

class EvaluationIndicatorResponse(Base):
    __tablename__ = "evaluation_indicator_response"

    id = Column(Integer, primary_key=True, autoincrement=True)

    evaluation_id = Column(
        Integer,
        ForeignKey("evaluations.id", ondelete="CASCADE"),
        nullable=False
    )

    indicator_id = Column(
        Integer,
        ForeignKey("indicators.id", ondelete="CASCADE"),
        nullable=False
    )

    maturity_level_id = Column(
        Integer,
        ForeignKey("maturity_levels.id", ondelete="CASCADE"),
        nullable=False
    )

    score = Column(Integer, nullable=False)
