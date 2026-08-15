from ..models.feedback_ambit_model import FeedbackAmbit
from ..models.maturity_level_model import MaturityLevel
from sqlalchemy import event
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

class Ambit(Base):
    __tablename__ = "ambits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    letter = Column(String(1))
    color = Column(String(20))
    is_removable = Column(Boolean, default=True)

    indicators = relationship(
        "Indicator",
        cascade="all, delete",
        passive_deletes=True
    )
    feedbacks = relationship(
        "FeedbackAmbit",
        cascade="all, delete",
        passive_deletes=True
    )
    
    feedbacks = relationship(
        "FeedbackAmbit",
        back_populates="ambit",
        cascade="all, delete"
    )


@event.listens_for(Ambit, "after_insert")
def create_feedbacks_for_new_ambit(mapper, connection, target):
    
    maturity_levels = connection.execute(
        MaturityLevel.__table__.select()
    ).fetchall()

   
    for ml in maturity_levels:
        connection.execute(
            FeedbackAmbit.__table__.insert().values(
                ambit_id=target.id,
                maturity_level_id=ml.id,
                text=""
            )
        )