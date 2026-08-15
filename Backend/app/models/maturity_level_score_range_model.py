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

class MaturityLevelScoreRange(Base):
    __tablename__ = "maturity_level_score_ranges"

    id = Column(Integer, primary_key=True, autoincrement=True)

    maturity_level_id = Column(
        Integer,
        ForeignKey("maturity_levels.id", ondelete="CASCADE"),
        nullable=False
    )

    min_score = Column(Float, nullable=False)
    max_score = Column(Float, nullable=False)

   
    maturity_level = relationship("MaturityLevel", back_populates="rank")
