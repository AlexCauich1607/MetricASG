from app.controllers.base_controller import BaseController
from app.models.ambit_model import Ambit

class AmbitsController(BaseController):
    model = Ambit
    prefix = "ambits"
    create_only_admin = True
    update_only_admin = True
    delete_only_admin = True
