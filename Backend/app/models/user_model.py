from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    Float,
    ForeignKey
)
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func
from ..database.database import Base
from ..core.roles import UserRole

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    #Información de usuario
    name = Column(String(150), nullable= True)
    lastname = Column(String(150), nullable = True)
    position =  Column(String(150), nullable = True)
    
    #Información de la Empresa
    company_name = Column(String(150), nullable= False)
    company_sector_id =  Column(
        Integer,
        ForeignKey("company_sectors.id", ondelete="SET NULL"),
        nullable=True
    )
    company_size_id =  Column(
        Integer,
        ForeignKey("company_sizes.id", ondelete="SET NULL"),
        nullable=True
    )
    
    #Información de contacto
    email = Column(String(150), unique=True, nullable=False)
    phone = Column(String(150), unique=False, nullable=True)
    
    
    password = Column(String(255), nullable=False)
    
    #Información Extra
    profile_photo = Column(Text, nullable=True)
    role = Column(
        String(50),
        default=UserRole.USER.value,
        nullable=False
    )
    joined = Column(DateTime, server_default=func.now())
    last_login = Column(DateTime)
    biannual_evaluation = Column(Boolean, default=False)
    next_evaluation = Column(DateTime)
    active = Column(Boolean, default=True)
    
    
    evaluations = relationship( "Evaluation", cascade="all, delete", passive_deletes=True)
    sector = relationship(
        "CompanySector",
        back_populates="users",
        passive_deletes=True
    )

    size = relationship(
        "CompanySize",
        back_populates="users",
        passive_deletes=True
    )
    
    
    
    relations = relationship(
    "CompanyRelationship",
    foreign_keys="CompanyRelationship.parent_company_id",
    cascade="all, delete-orphan",
    passive_deletes=True
    )

    related_to = relationship(
        "CompanyRelationship",
        foreign_keys="CompanyRelationship.related_company_id",
        passive_deletes=True
    )

    @validates("role")
    def validate_role(self, key, value):
        if isinstance(value, UserRole):
            return value.value

        try:
            return UserRole(value).value
        except ValueError as exc:
            allowed_roles = ", ".join(role.value for role in UserRole)

            raise ValueError(
                f"Invalid role '{value}'. Allowed roles: {allowed_roles}"
            ) from exc
