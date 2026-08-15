from app.controllers.base_controller import BaseController
from app.models.feedback_ambit_model import FeedbackAmbit

class FeedbackAmbitController(BaseController):
    model = FeedbackAmbit
    prefix = "feedback-ambit"
