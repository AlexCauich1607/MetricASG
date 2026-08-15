from sqlalchemy import Column, Integer, Text, ForeignKey, event
from sqlalchemy.orm import relationship
from sqlalchemy import event
from ..database.database import Base

class Indicator(Base):
    __tablename__ = "indicators"

    id = Column(Integer, primary_key=True, autoincrement=True)

    ambit_id = Column(
        Integer,
        ForeignKey("ambits.id", ondelete="CASCADE"),
        nullable=False
    )

    question = Column(Text)


    answers = relationship(
        "IndicatorAnswer",
        back_populates="indicator",
        cascade="all, delete"
    )



@event.listens_for(Indicator, "after_insert")
def create_answers_for_new_indicator(mapper, connection, target):

    maturity_levels = connection.execute(
        Base.metadata.tables["maturity_levels"].select()
    ).fetchall()

    for ml in maturity_levels:
        connection.execute(
            Base.metadata.tables["indicator_answers"]
            .insert()
            .values(
                indicator_id=target.id,
                maturity_level_id=ml.id,
                text=""
            )
        )
