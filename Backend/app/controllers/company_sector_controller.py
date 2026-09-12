from ..controllers.base_controller import BaseController
from ..models.company_sector_model import CompanySector

class CompanySectorController(BaseController):
    model = CompanySector
    prefix = "company-sectors"
    create_only_admin = True
    update_only_admin = True
    delete_only_admin = True