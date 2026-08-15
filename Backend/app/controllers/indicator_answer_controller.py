from app.controllers.base_controller import BaseController
from app.models.indicator_answer_model import IndicatorAnswer

class IndicatorAnswersController(BaseController):
    model = IndicatorAnswer
    prefix = "indicator-answers"
