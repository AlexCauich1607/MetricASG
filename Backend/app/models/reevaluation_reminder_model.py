
from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Integer,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database.database import Base


class ReminderType(str, PyEnum):
    FIRST = "FIRST"
    SECOND = "SECOND"
    DUE = "DUE"


class ReminderChannel(str, PyEnum):
    IN_APP = "IN_APP"
    EMAIL = "EMAIL"


class ReminderStatus(str, PyEnum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class ReevaluationReminder(Base):
    __tablename__ = "reevaluation_reminders"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "target_date",
            "reminder_type",
            "channel",
            name="uq_reevaluation_reminder_delivery",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    target_date = Column(Date, nullable=False)

    reminder_type = Column(
        SqlEnum(
            ReminderType,
            name="reevaluation_reminder_type",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
    )

    channel = Column(
        SqlEnum(
            ReminderChannel,
            name="reevaluation_reminder_channel",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
    )

    status = Column(
        SqlEnum(
            ReminderStatus,
            name="reevaluation_reminder_status",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
        default=ReminderStatus.PENDING,
        server_default=ReminderStatus.PENDING.value,
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

    sent_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    user = relationship(
        "User",
        back_populates="reevaluation_reminders",
    )
