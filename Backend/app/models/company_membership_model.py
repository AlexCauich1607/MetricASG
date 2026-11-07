
from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Integer,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database.database import Base


class CompanyMembershipStatus(str, PyEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class CompanyMembership(Base):
    __tablename__ = "company_memberships"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    status = Column(
        SqlEnum(
            CompanyMembershipStatus,
            name="company_membership_status",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
        default=CompanyMembershipStatus.ACTIVE,
        server_default=CompanyMembershipStatus.ACTIVE.value,
    )

    joined_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user = relationship(
        "User",
        back_populates="company_memberships",
    )

    company = relationship(
        "Company",
        back_populates="memberships",
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "company_id",
            name="uq_company_membership_user_company",
        ),
    )
