from ..controllers.base_controller import BaseController
from ..models.company_sizes_model import CompanySize

class CompanySizeController(BaseController):
    model = CompanySize
    prefix = "company-sizes"
    
 