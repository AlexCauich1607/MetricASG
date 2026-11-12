
from sqlalchemy import (
    Column,
    DateTime,
    Index,
    Integer,
    JSON,
    String,
)
from sqlalchemy.sql import func

from ..database.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    actor_id = Column(
        Integer,
        nullable=True,
    )

    company_id = Column(
        Integer,
        nullable=True,
    )

    action = Column(
        String(100),
        nullable=False,
    )

    resource_type = Column(
        String(100),
        nullable=False,
    )

    resource_id = Column(
        Integer,
        nullable=True,
    )

    context = Column(
        JSON,
        nullable=False,
        default=dict,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_audit_logs_actor_id", "actor_id"),
        Index("ix_audit_logs_company_id", "company_id"),
        Index("ix_audit_logs_action", "action"),
        Index("ix_audit_logs_created_at", "created_at"),
    )
