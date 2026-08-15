from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from ..database.database import Base

class CompanySector(Base):
    __tablename__ = "company_sectors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False, unique=True)

    users = relationship(
        "User",
        back_populates="sector"
    )