
from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Integer,
    String,
    Index,
    text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database.database import Base


class CompanyInvitationStatus(str, PyEnum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REVOKED = "REVOKED"
    EXPIRED = "EXPIRED"


class CompanyInvitation(Base):
    __tablename__ = "company_invitations"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    invited_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    email = Column(
        String(255),
        nullable=False,
        index=True,
    )

    token_hash = Column(
        String(64),
        nullable=False,
        unique=True,
    )

    status = Column(
        SqlEnum(
            CompanyInvitationStatus,
            name="company_invitation_status",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
        default=CompanyInvitationStatus.PENDING,
        server_default=CompanyInvitationStatus.PENDING.value,
    )

    expires_at = Column(
        DateTime(timezone=True),
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    accepted_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    last_resent_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    company = relationship("Company")

    invited_by = relationship("User")

    __table_args__ = (
        Index(
            "uq_company_invitations_pending_company_email",
            "company_id",
            "email",
            unique=True,
            postgresql_where=text("status = 'PENDING'"),
        ),
    )
