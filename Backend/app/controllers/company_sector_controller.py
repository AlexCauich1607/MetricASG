from ..controllers.base_controller import BaseController
from ..models.company_sector_model import CompanySector

class CompanySectorController(BaseController):
    model = CompanySector
    prefix = "company-sectors"
    
 