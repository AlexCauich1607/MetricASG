from datetime import datetime, timedelta

from ..models.ambit_model import Ambit
from ..models.maturity_level_model import MaturityLevel
from ..models.evaluation_ambit_score_model import EvaluationAmbitScore
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from ..models.user_model import User
from ..models.evaluation_model import Evaluation
from ..services.audit_service import AuditService
from ..models.company_model import Company
from ..models.evaluation_model import EvaluationStatus

class AdminService:
    

    def change_user_state(
        self,
        id: int,
        db: Session,
        actor_id: int,
    ):
        user = db.query(User).filter(User.id == id).first()

        if not user:
            raise HTTPException(
                status_code=401,
                detail="The user is not exist",
            )

        previous_state = user.active
        user.active = not user.active

        try:
            AuditService.record(
                db=db,
                action="user.state_changed",
                resource_type="user",
                resource_id=user.id,
                actor_id=actor_id,
                context={
                    "previous_active": previous_state,
                    "current_active": user.active,
                },
            )

            db.commit()

            return {"message": "User update success"}

        except Exception:
            db.rollback()
            raise

        
    def get_summary(self, db: Session):

        total_users = db.query(User)\
            .filter(User.role == "user")\
            .count()

        # Las cuentas personales y las empresas son entidades distintas.
        total_companies = (
            db.query(Company)
            .filter(Company.active.is_(True))
            .count()
        )

        completed = (
            db.query(func.count(func.distinct(Evaluation.company_id)))
            .join(Company, Company.id == Evaluation.company_id)
            .filter(
                Company.active.is_(True),
                Evaluation.status == EvaluationStatus.COMPLETED,
            )
            .scalar()
        ) or 0

        pending = total_companies - completed

        # Identificar la última evaluación completada por empresa.
        # La fecha determina la más reciente; el ID rompe empates.
        ranked_evaluations = (
            db.query(
                Evaluation.id.label("evaluation_id"),
                func.row_number().over(
                    partition_by=Evaluation.company_id,
                    order_by=(
                        Evaluation.date.desc().nullslast(),
                        Evaluation.id.desc(),
                    ),
                ).label("row_number"),
            )
            .filter(
                Evaluation.status == EvaluationStatus.COMPLETED,
                Evaluation.company_id.isnot(None),
            )
            .subquery()
        )

        latest_evaluations = (
            db.query(ranked_evaluations.c.evaluation_id)
            .filter(ranked_evaluations.c.row_number == 1)
            .subquery()
        )

        global_avg = (
            db.query(func.avg(Evaluation.global_score))
            .join(Company, Company.id == Evaluation.company_id)
            .filter(
                Company.active.is_(True),
                Evaluation.id.in_(
                    db.query(latest_evaluations.c.evaluation_id)
                ),
            )
            .scalar()
        )

        ambit_rows = (
            db.query(
                EvaluationAmbitScore.ambit_id,
                EvaluationAmbitScore.maturity_level_id,
                func.count(
                    func.distinct(Evaluation.company_id)
                ).label("company_count"),
            )
            .join(
                Evaluation,
                Evaluation.id
                == EvaluationAmbitScore.evaluation_id,
            )
            .join(
                Company,
                Company.id == Evaluation.company_id,
            )
            .filter(
                Company.active.is_(True),
                Evaluation.id.in_(
                    db.query(latest_evaluations.c.evaluation_id)
                ),
            )
            .group_by(
                EvaluationAmbitScore.ambit_id,
                EvaluationAmbitScore.maturity_level_id,
            )
            .all()
        )

        users_by_month = (
            db.query(
                func.to_char(User.joined, 'YYYY-MM').label("month"),
                func.count(User.id).label("count")
            )
            .filter(User.role == "user")
            .group_by("month")
            .order_by("month")
            .all()
        )
        
      
        ambits = {
            a.id: a for a in db.query(Ambit).all()
        }

        maturity_levels = {
            ml.id: ml for ml in db.query(MaturityLevel).order_by(MaturityLevel.value).all()
        }

        
        result = {}

        for ambit_id, maturity_id, count in ambit_rows:

            ambit = ambits[ambit_id]

            if ambit_id not in result:
                result[ambit_id] = {
                    "id": ambit.id,
                    "name": ambit.name,
                    "letter": ambit.letter,
                    "color": ambit.color,
                    "maturity_levels": [
                        {
                            "id": level.id,
                            "name": level.name,
                            "color": level.color,
                            "user_count": 0
                        }
                        for level in maturity_levels.values()
                    ]
                }

     
            for level in result[ambit_id]["maturity_levels"]:
                if level["id"] == maturity_id:
                    level["user_count"] = count
                    break
        


        return {
            "users": {
                "total": total_users,
            },
            "companies": {
                "total": total_companies,
                "completed_evaluation": completed,
                "pending_evaluation": pending,
            },
            "asg": {
                "global_average": round(global_avg, 2) if global_avg else 0
            },
            "users_by_month": [
                {
                    "month": row.month,
                    "count": row.count
                }
                for row in users_by_month
            ],
            "ambits": list(result.values())
        }
        
    def getUsers(self, db:Session):
        users = db.query(User)\
            .filter(User.role == "user")\
            .all()
            
        admin = db.query(User)\
            .filter(User.role == "admin")\
            .all()
        return {
            "users": users,
            "admin": admin
        }
        
        
        