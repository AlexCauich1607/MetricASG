
from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base
from app.models.improvement_action_model import ImprovementPriority


class AIRecommendationStatus(str, PyEnum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


class AIRecommendation(Base):
    __tablename__ = "ai_recommendations"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    evaluation_id = Column(
        Integer,
        ForeignKey("evaluations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    indicator_id = Column(
        Integer,
        ForeignKey("indicators.id", ondelete="RESTRICT"),
        nullable=True,
    )

    gap_description = Column(Text, nullable=False)

    title = Column(String(255), nullable=False)

    description = Column(Text, nullable=False)

    justification = Column(Text, nullable=False)

    priority = Column(
        SqlEnum(
            ImprovementPriority,
            name="improvement_priority",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
    )

    status = Column(
        SqlEnum(
            AIRecommendationStatus,
            name="ai_recommendation_status",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
        default=AIRecommendationStatus.PENDING,
        server_default=AIRecommendationStatus.PENDING.value,
    )

    reviewed_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )

    reviewed_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    improvement_action_id = Column(
        Integer,
        ForeignKey(
            "improvement_actions.id",
            ondelete="RESTRICT",
        ),
        nullable=True,
        unique=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    evaluation = relationship("Evaluation")

    indicator = relationship("Indicator")

    reviewer = relationship(
        "User",
        foreign_keys=[reviewed_by],
    )

    improvement_action = relationship(
        "ImprovementAction",
        foreign_keys=[improvement_action_id],
    )
