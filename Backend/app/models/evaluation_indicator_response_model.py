from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint

from ..database.database import Base


class EvaluationIndicatorResponse(Base):
    __tablename__ = "evaluation_indicator_response"

    __table_args__ = (
        UniqueConstraint(
            "evaluation_id",
            "indicator_id",
            name="uq_evaluation_indicator_response",
        ),
    )

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    evaluation_id = Column(
        Integer,
        ForeignKey("evaluations.id", ondelete="CASCADE"),
        nullable=False,
    )

    indicator_id = Column(
        Integer,
        ForeignKey("indicators.id", ondelete="CASCADE"),
        nullable=False,
    )

    indicator_answer_id = Column(
        Integer,
        ForeignKey("indicator_answers.id", ondelete="RESTRICT"),
        nullable=True,
    )

    maturity_level_id = Column(
        Integer,
        ForeignKey("maturity_levels.id", ondelete="CASCADE"),
        nullable=False,
    )

    score = Column(Integer, nullable=False)
