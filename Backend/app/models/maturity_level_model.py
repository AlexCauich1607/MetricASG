from sqlalchemy import (
    Boolean,
    Column,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    event,
)
from sqlalchemy.orm import relationship

from ..database.database import Base

class MaturityLevel(Base):
    __tablename__ = "maturity_levels"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    value = Column(Integer, nullable=False)
    description = Column(Text)
    min_score = Column(Float, nullable=False)
    max_score = Column(Float, nullable=False)
    color = Column(String(20))
    is_removable = Column(Boolean, default=True)

    methodology_id = Column(
        Integer,
        ForeignKey("methodologies.id", ondelete="RESTRICT"),
        nullable=False,
    )
    indicator_answers = relationship(
        "IndicatorAnswer",
        back_populates="maturity_level",
        cascade="all, delete"
    )

    feedbacks = relationship(
        "FeedbackAmbit",
        back_populates="maturity_level",
        cascade="all, delete"
    )

    rank = relationship(
        "MaturityLevelScoreRange",
        back_populates="maturity_level",
        cascade="all, delete",
        uselist=False
    )

    methodology = relationship(
        "Methodology",
        back_populates="maturity_levels",
    )


@event.listens_for(MaturityLevel, "after_insert")
def create_related_records(mapper, connection, target):

    ambits_table = Base.metadata.tables["ambits"]
    indicators_table = Base.metadata.tables["indicators"]

    ambits = connection.execute(
        ambits_table
        .select()
        .where(
            ambits_table.c.methodology_id
            == target.methodology_id
        )
    ).fetchall()

    ambit_ids = [ambit.id for ambit in ambits]

    indicators = []

    if ambit_ids:
        indicators = connection.execute(
            indicators_table
            .select()
            .where(indicators_table.c.ambit_id.in_(ambit_ids))
        ).fetchall()

   
    for ind in indicators:
        connection.execute(
            Base.metadata.tables["indicator_answers"]
            .insert()
            .values(
                indicator_id=ind.id,
                maturity_level_id=target.id, 
                text=""
            )
        )


    for amb in ambits:
        connection.execute(
            Base.metadata.tables["feedback_ambit"]
            .insert()
            .values(
                ambit_id=amb.id,
                maturity_level_id=target.id,
                text=""
            )
        )

    connection.execute(
        Base.metadata.tables["maturity_level_score_ranges"]
        .insert()
        .values(
            maturity_level_id=target.id,
            min_score=0.0,
            max_score=100.0
        )
    )
