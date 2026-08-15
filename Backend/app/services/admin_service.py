from datetime import datetime, timedelta

from ..models.ambit_model import Ambit
from ..models.maturity_level_model import MaturityLevel
from ..models.evaluation_ambit_score_model import EvaluationAmbitScore
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from ..models.user_model import User
from ..models.evaluation_model import Evaluation

class AdminService:
    
    def change_user_state(self, id: int, db:Session):
        user = db.query(User).filter(User.id == id).first()
        if not user:
             raise HTTPException(status_code=401, detail="The user is not exist")
        if user.active is True:
            user.active = False
        else:
            user.active = True
        db.commit()
        return {"message": "User update success"}
        
    def get_summary(self, db: Session):

        total_users = db.query(User)\
            .filter(User.role == "user")\
            .count()

        completed = db.query(User)\
            .filter(
                User.role == "user",
                User.biannual_evaluation == True
            )\
            .count()

        pending = total_users - completed

       
        subquery = (
            db.query(
                func.max(Evaluation.id).label("last_eval_id")
            )
            .group_by(Evaluation.user_id)
            .subquery()
        )

       
        global_avg = (
            db.query(func.avg(Evaluation.global_score))
            .join(User, User.id == Evaluation.user_id)
            .filter(User.role == "user")
            .filter(Evaluation.id.in_(subquery))
            .scalar()
        )
        
        ambit_rows = (
            db.query(
                EvaluationAmbitScore.ambit_id,
                EvaluationAmbitScore.maturity_level_id,
                func.count(func.distinct(Evaluation.user_id)).label("user_count")
            )
            .join(Evaluation,
                  Evaluation.id == EvaluationAmbitScore.evaluation_id)
            .join(User,
                  User.id == Evaluation.user_id)
            .filter(User.role == "user")
            .filter(Evaluation.id.in_(subquery))
            .group_by(
                EvaluationAmbitScore.ambit_id,
                EvaluationAmbitScore.maturity_level_id
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
                "completed_evaluation": completed,
                "pending_evaluation": pending
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
        
        
        