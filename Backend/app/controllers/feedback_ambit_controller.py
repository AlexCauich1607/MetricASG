from app.controllers.base_controller import BaseController
from app.models.feedback_ambit_model import FeedbackAmbit
from app.services.methodology_catalog_service import MethodologyCatalogService

class FeedbackAmbitController(BaseController):
    model = FeedbackAmbit
    prefix = "feedback-ambit"
    create_only_admin = True
    update_only_admin = True
    delete_only_admin = True
    service_class = MethodologyCatalogService