from enum import Enum

class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"

class CompanyRole(str, Enum):
    COMPANY_ADMIN = "COMPANY_ADMIN"
    ASG_MANAGER = "ASG_MANAGER"
    COLLABORATOR = "COLLABORATOR"
    AUDITOR = "AUDITOR"