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

class IndicatorAnswer(Base):
    __tablename__ = "indicator_answers"

    id = Column(Integer, primary_key=True, autoincrement=True)

    indicator_id = Column(
        Integer,
        ForeignKey("indicators.id", ondelete="CASCADE"),
        nullable=False
    )

    maturity_level_id = Column(
        Integer,
        ForeignKey("maturity_levels.id", ondelete="CASCADE")
    )

    text = Column(Text)
    
    maturity_level = relationship("MaturityLevel", back_populates="indicator_answers")
    indicator = relationship("Indicator", back_populates="answers")
