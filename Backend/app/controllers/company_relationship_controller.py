from app.controllers.base_controller import BaseController
from app.models.company_relationship_model import CompanyRelationship

class CompanyRelationshipController(BaseController):
    model = CompanyRelationship
    prefix = "company-relationships"
