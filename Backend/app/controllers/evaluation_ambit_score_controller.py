from app.controllers.base_controller import BaseController
from app.models.evaluation_ambit_score_model import EvaluationAmbitScore

class EvaluationAmbitScoresController(BaseController):
    model = EvaluationAmbitScore
    prefix = "evaluation-ambit-scores"
    
 