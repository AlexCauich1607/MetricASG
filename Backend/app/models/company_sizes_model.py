from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from ..database.database import Base

class CompanySize(Base):
    __tablename__ = "company_sizes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False, unique=True)

    users = relationship(
        "User",
        back_populates="size"
    )