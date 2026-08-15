from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from ..database.database import Base

class CompanyRelationship(Base):
    __tablename__ = "company_relationships"

    id = Column(Integer, primary_key=True, autoincrement=True)

    parent_company_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    related_company_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    parent_company = relationship(
        "User",
        foreign_keys=[parent_company_id]
    )

    related_company = relationship(
        "User",
        foreign_keys=[related_company_id]
    )

    __table_args__ = (
        UniqueConstraint(
            "parent_company_id",
            "related_company_id",
            name="uq_company_relationship"
        ),
    )
