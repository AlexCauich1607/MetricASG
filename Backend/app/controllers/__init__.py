from .user_controller import UsersController
from .ambit_controller import AmbitsController
from .indicator_controller import IndicatorsController
from .maturity_level_controller import MaturityLevelsController
from .indicator_answer_controller import IndicatorAnswersController
from .evaluation_controller import EvaluationsController
from .evaluation_ambit_score_controller import EvaluationAmbitScoresController
from .evaluation_indicator_response_controller import EvaluationIndicatorResponseController
from .feedback_ambit_controller import FeedbackAmbitController
from .maturity_level_score_range_controller import MaturityLevelsScoreRankController
from .auth_controller import AuthController
from .admin_controller import AdminController
from .company_sector_controller import CompanySectorController
from .company_size_controller import CompanySizeController
from .company_relationship_controller import CompanyRelationshipController

controllers = [
    UsersController(),
    AmbitsController(),
    IndicatorsController(),
    MaturityLevelsController(),
    IndicatorAnswersController(),
    EvaluationsController(),
    EvaluationAmbitScoresController(),
    EvaluationIndicatorResponseController(),
    FeedbackAmbitController(),
    MaturityLevelsScoreRankController(),
    AuthController(),
    AdminController(),
    CompanySectorController(),
    CompanySizeController(),
    CompanyRelationshipController()
]
