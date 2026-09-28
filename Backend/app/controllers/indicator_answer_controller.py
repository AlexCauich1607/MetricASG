from app.controllers.base_controller import BaseController
from app.models.indicator_answer_model import IndicatorAnswer
from app.services.methodology_catalog_service import MethodologyCatalogService

class IndicatorAnswersController(BaseController):
    model = IndicatorAnswer
    prefix = "indicator-answers"
    create_only_admin = True
    update_only_admin = True
    delete_only_admin = True
    service_class = MethodologyCatalogService