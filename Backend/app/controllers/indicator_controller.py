from app.controllers.base_controller import BaseController
from app.models.indicator_model import Indicator

class IndicatorsController(BaseController):
    model = Indicator
    prefix = "indicators"
    create_only_admin = True
    update_only_admin = True
    delete_only_admin = True