from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database.database import Base


class NotificationEventPreference(Base):
    __tablename__ = "notification_event_preferences"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "event_type",
            name="uq_notification_event_preference_user_event",
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

    event_type = Column(
        String(80),
        nullable=False,
    )

    in_app_enabled = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    email_enabled = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
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

    user = relationship(
        "User",
        back_populates="notification_event_preferences",
    )
