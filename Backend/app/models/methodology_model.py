from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Enum as SqlEnum,
    Index,
    Integer,
    String,
    text,
)

from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database.database import Base


class MethodologyStatus(str, PyEnum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class Methodology(Base):
    __tablename__ = "methodologies"
    __table_args__ = (
        CheckConstraint(
            "NOT is_active OR status = 'PUBLISHED'",
            name="ck_methodology_active_published",
        ),
        Index(
            "uq_methodologies_single_active",
            "is_active",
            unique=True,
            postgresql_where=text("is_active = true"),
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String(150), nullable=False)

    version = Column(
        String(50),
        nullable=False,
        unique=True,
    )

    status = Column(
        SqlEnum(
            MethodologyStatus,
            name="methodology_status",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
        default=MethodologyStatus.DRAFT,
        server_default=MethodologyStatus.DRAFT.value,
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    ambits = relationship(
        "Ambit",
        back_populates="methodology",
    )

    maturity_levels = relationship(
        "MaturityLevel",
        back_populates="methodology",
    )

    evaluations = relationship(
        "Evaluation",
        back_populates="methodology",
    )
