from app.controllers.base_controller import BaseController
from app.models.indicator_model import Indicator

class IndicatorsController(BaseController):
    model = Indicator
    prefix = "indicators"
