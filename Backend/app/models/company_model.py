
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    name = Column(
        String(150),
        nullable=False,
    )

    sector_id = Column(
        Integer,
        ForeignKey("company_sectors.id", ondelete="SET NULL"),
        nullable=True,
    )

    size_id = Column(
        Integer,
        ForeignKey("company_sizes.id", ondelete="SET NULL"),
        nullable=True,
    )

    active = Column(
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

    memberships = relationship(
        "CompanyMembership",
        back_populates="company",
    )

    evaluations = relationship(
        "Evaluation",
        back_populates="company",
    )
