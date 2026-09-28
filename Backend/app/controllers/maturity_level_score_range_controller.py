from app.controllers.base_controller import BaseController
from app.models.maturity_level_score_range_model import MaturityLevelScoreRange
from app.services.methodology_catalog_service import MethodologyCatalogService

class MaturityLevelsScoreRankController(BaseController):
    model = MaturityLevelScoreRange
    prefix = "maturity-levels-score-range"
    create_only_admin = True
    update_only_admin = True
    delete_only_admin = True
    service_class = MethodologyCatalogService
    