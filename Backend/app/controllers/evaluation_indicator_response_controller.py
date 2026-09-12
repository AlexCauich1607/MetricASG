from app.controllers.base_controller import BaseController
from app.models.evaluation_indicator_response_model import EvaluationIndicatorResponse

class EvaluationIndicatorResponseController(BaseController):
    model = EvaluationIndicatorResponse
    prefix = "evaluation-indicator-response"
    read_only_admin = True
    read_all_only_admin = True
    create_only_admin = True
    update_only_admin = True
    delete_only_admin = True
