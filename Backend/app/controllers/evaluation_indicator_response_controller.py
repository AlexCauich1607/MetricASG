from app.controllers.base_controller import BaseController
from app.models.evaluation_indicator_response_model import EvaluationIndicatorResponse

class EvaluationIndicatorResponseController(BaseController):
    model = EvaluationIndicatorResponse
    prefix = "evaluation-indicator-response"
