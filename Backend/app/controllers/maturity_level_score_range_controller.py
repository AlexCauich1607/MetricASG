from app.controllers.base_controller import BaseController
from app.models.maturity_level_score_range_model import MaturityLevelScoreRange

class MaturityLevelsScoreRankController(BaseController):
    model = MaturityLevelScoreRange
    prefix = "maturity-levels-score-range"
    