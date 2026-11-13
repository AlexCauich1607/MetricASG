from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database.database import Base


class NotificationChannel(str, PyEnum):
    IN_APP = "IN_APP"
    EMAIL = "EMAIL"


class NotificationStatus(str, PyEnum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class Notification(Base):
    __tablename__ = "notifications"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "channel",
            "deduplication_key",
            name="uq_notification_recipient_channel_event",
        ),
    )

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    event_type = Column(
        String(80),
        nullable=False,
        index=True,
    )

    channel = Column(
        SqlEnum(
            NotificationChannel,
            name="notification_channel",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
    )

    title = Column(String(200), nullable=False)

    message = Column(Text, nullable=False)

    resource_type = Column(String(80), nullable=True)

    resource_id = Column(Integer, nullable=True)

    deduplication_key = Column(String(255), nullable=False)

    status = Column(
        SqlEnum(
            NotificationStatus,
            name="notification_status",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
        default=NotificationStatus.PENDING,
        server_default=NotificationStatus.PENDING.value,
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

    read_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    user = relationship(
        "User",
        back_populates="notifications",
    )

    company = relationship("Company")
