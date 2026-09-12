from fastapi import Depends
from sqlalchemy.orm import Session
from ..controllers.base_controller import BaseController
from ..database.database import get_db
from ..models.evaluation_model import Evaluation
from ..services.evaluations_service import EvaluationService
from ..models.user_model import User
from ..services.token_service import get_current_user


class EvaluationsController(BaseController):
    model = Evaluation
    prefix = "evaluations"
    read_only_admin = True
    read_all_only_admin = True
    create_only_admin = True
    update_only_admin = True
    delete_only_admin = True

    def __init__(self):
        super().__init__()

        @self.router.get("/structure/all")
        def get_structure(db: Session = Depends(get_db)):
            return EvaluationService(db).get_structure()
        
        @self.router.post("/submit")
        def submit_evaluation(
            payload: dict,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db)
        ):
            return EvaluationService(db).submit_evaluation(
                payload,
                current_user.id
            )
        
        
        @self.router.get("/results/me")
        def get_latest_results(
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db)
        ):
            return EvaluationService(db).get_latest_results(
                current_user.id
            )

        @self.router.get("/history/me")
        def get_history(
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db)
        ):
            return EvaluationService(db).get_evaluation_history(
                current_user.id
            )