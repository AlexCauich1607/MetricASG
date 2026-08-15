from fastapi import Depends
from sqlalchemy.orm import Session
from ..controllers.base_controller import BaseController
from ..database.database import get_db
from ..models.evaluation_model import Evaluation
from ..services.evaluations_service import EvaluationService


class EvaluationsController(BaseController):
    model = Evaluation
    prefix = "evaluations"

    def __init__(self):
        super().__init__()

        @self.router.get("/structure/all")
        def get_structure(db: Session = Depends(get_db)):
            return EvaluationService(db).get_structure()
        
        @self.router.post("/submit")
        def submit_evaluation(
            payload: dict,
            db: Session = Depends(get_db)
        ):
            return EvaluationService(db).submit_evaluation(payload)
        
        
        @self.router.get("/results/{user_id}")
        def get_latest_results(user_id: int, db: Session = Depends(get_db)):
            return EvaluationService(db).get_latest_results(user_id)
        
        @self.router.get("/history/{user_id}")
        def get_history(user_id: int, db: Session = Depends(get_db)):
            return EvaluationService(db).get_evaluation_history(user_id)