
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

    # Estado de evaluación ASG de la empresa.
    # True indica que ya completó al menos una evaluación.
    biannual_evaluation = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    # Fecha en la que corresponde la siguiente evaluación semestral.
    # NULL cuando la empresa todavía no ha completado ninguna.
    next_evaluation = Column(
        DateTime,
        nullable=True,
    )

    memberships = relationship(
        "CompanyMembership",
        back_populates="company",
    )

    evaluations = relationship(
        "Evaluation",
        back_populates="company",
    )
