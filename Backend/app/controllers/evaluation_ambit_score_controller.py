from app.controllers.base_controller import BaseController
from app.models.evaluation_ambit_score_model import EvaluationAmbitScore

class EvaluationAmbitScoresController(BaseController):
    model = EvaluationAmbitScore
    prefix = "evaluation-ambit-scores"
    read_only_admin = True
    read_all_only_admin = True
    create_only_admin = True
    update_only_admin = True
    delete_only_admin = True
    
 