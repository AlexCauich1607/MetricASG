from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database.database import Base

class ImprovementPriority(str, PyEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class ImprovementStatus(str, PyEnum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ImprovementAction(Base):
    __tablename__ = "improvement_actions"

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

    description = Column(Text, nullable=False)

    priority = Column(
        SqlEnum(
            ImprovementPriority,
            name="improvement_priority",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
        default=ImprovementPriority.MEDIUM,
        server_default=ImprovementPriority.MEDIUM.value,
    )

    responsible = Column(String(150), nullable=False)

    target_date = Column(Date, nullable=False)

    status = Column(
        SqlEnum(
            ImprovementStatus,
            name="improvement_status",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
        default=ImprovementStatus.PENDING,
        server_default=ImprovementStatus.PENDING.value,
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

    evaluation = relationship(
        "Evaluation",
        back_populates="improvement_actions",
    )

    indicator = relationship(
        "Indicator",
        back_populates="improvement_actions",
    )
