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

class FeedbackAmbit(Base):
    __tablename__ = "feedback_ambit"

    id = Column(Integer, primary_key=True, autoincrement=True)

    ambit_id = Column(
        Integer,
        ForeignKey("ambits.id", ondelete="CASCADE"),
        nullable=False
    )

    maturity_level_id = Column(
        Integer,
        ForeignKey("maturity_levels.id", ondelete="CASCADE"),
        nullable=False
    )

    text = Column(Text)
    
    maturity_level = relationship("MaturityLevel", back_populates="feedbacks")
    ambit = relationship("Ambit", back_populates="feedbacks")