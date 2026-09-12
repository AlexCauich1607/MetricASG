from app.controllers.base_controller import BaseController
from app.models.maturity_level_model import MaturityLevel

class MaturityLevelsController(BaseController):
    model = MaturityLevel
    prefix = "maturity-levels"
    create_only_admin = True
    update_only_admin = True
    delete_only_admin = True
