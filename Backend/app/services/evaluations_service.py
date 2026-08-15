from collections import defaultdict
from datetime import date
from http.client import HTTPException

from dateutil.relativedelta import relativedelta

from ..models.feedback_ambit_model import FeedbackAmbit

from ..models.user_model import User

from ..models.evaluation_ambit_score_model import EvaluationAmbitScore
from ..models.evaluation_indicator_response_model import EvaluationIndicatorResponse
from ..models.evaluation_model import Evaluation
from ..models.ambit_model import Ambit;
from ..models.indicator_model import Indicator;
from ..models.indicator_answer_model import IndicatorAnswer;
from ..models.maturity_level_model import MaturityLevel;

class EvaluationService:

    def __init__(self, db):
        self.db = db

    def get_structure(self):

        ambits = self.db.query(Ambit).all()
        maturity_levels = self.db.query(MaturityLevel)\
            .order_by(MaturityLevel.value).all()

        result = {"ambits": []}

        for ambit in ambits:
            ambit_data = {
                "id": ambit.id,
                "name": ambit.name,
                "letter": ambit.letter,
                "color": ambit.color,
                "indicators": []
            }

            indicators = self.db.query(Indicator)\
                .filter(Indicator.ambit_id == ambit.id).all()

            for indicator in indicators:
                answers = self.db.query(IndicatorAnswer)\
                    .filter(IndicatorAnswer.indicator_id == indicator.id).all()

                indicator_data = {
                    "id": indicator.id,
                    "question": indicator.question,
                    "answers": []
                }

                for answer in answers:
                    ml = next(
                        (m for m in maturity_levels if m.id == answer.maturity_level_id),
                        None
                    )

                    indicator_data["answers"].append({
                        "maturity_level_id": answer.maturity_level_id,
                        "maturity_name": ml.name if ml else None,
                        "value": ml.value if ml else None,
                        "text": answer.text
                    })
                indicator_data["answers"].sort(key=lambda x: x["value"])
                ambit_data["indicators"].append(indicator_data)

            result["ambits"].append(ambit_data)

        return result
    
    
    
    def submit_evaluation(self, payload: dict):

        user_id = payload["user_id"]
        responses = payload["responses"]

        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(404, "User not found")

       
        evaluation = Evaluation(
            user_id=user_id,
            date=date.today()
        )
        
        self.db.add(evaluation)
        self.db.flush()  

       
        ambit_scores = defaultdict(list)

       
        for r in responses:
            indicator = self.db.query(Indicator).get(r["indicator_id"])
            maturity = self.db.query(MaturityLevel).get(r["maturity_level_id"])

            if not indicator or not maturity:
                continue

            response = EvaluationIndicatorResponse(
                evaluation_id=evaluation.id,
                indicator_id=indicator.id,
                maturity_level_id=maturity.id,
                score=maturity.value   
            )

            self.db.add(response)
            
            ambit_scores[indicator.ambit_id].append(maturity.value)

       
        global_scores = []
        

        for ambit_id, scores in ambit_scores.items():
            avg_score = sum(scores) / len(scores)
            maturity_level = (
                self.db.query(MaturityLevel)
                .filter(
                    MaturityLevel.min_score <= avg_score,
                    MaturityLevel.max_score >= avg_score
                )
                .first()
            )
            ambit_score = EvaluationAmbitScore(
                evaluation_id=evaluation.id,
                ambit_id=ambit_id,
                score=avg_score,
                maturity_level_id = maturity_level.id,
            )

            self.db.add(ambit_score)
            global_scores.append(avg_score)

       
        evaluation.global_score = (
            sum(global_scores) / len(global_scores)
            if global_scores else 0
        )

        user.biannual_evaluation = True
        user.next_evaluation = date.today() + relativedelta(months=6)

        self.db.commit()

        return {
            "evaluation_id": evaluation.id,
            "global_score": evaluation.global_score
        }
    
    def get_latest_results(self, user_id: int):

        evaluation = (
            self.db.query(Evaluation)
            .filter(Evaluation.user_id == user_id)
            .order_by(Evaluation.id.desc())
            .first()
        )

        if not evaluation:
            raise HTTPException(404, "No evaluations found")

        ambit_results = []

        ambit_scores = (
            self.db.query(EvaluationAmbitScore)
            .filter(EvaluationAmbitScore.evaluation_id == evaluation.id)
            .all()
        )

        for ambit_score in ambit_scores:


            maturity = (
                self.db.query(MaturityLevel)
                .filter(
                    MaturityLevel.min_score <= ambit_score.score,
                    MaturityLevel.max_score >= ambit_score.score
                )
                .first()
            )

            feedback = None
            if maturity:
                fb = (
                    self.db.query(FeedbackAmbit)
                    .filter(
                        FeedbackAmbit.ambit_id == ambit_score.ambit_id,
                        FeedbackAmbit.maturity_level_id == maturity.id
                    )
                    .first()
                )
                feedback = fb.text if fb else None

            ambit = self.db.query(Ambit).get(ambit_score.ambit_id)

            ambit_results.append({
                "ambit_id": ambit.id,
                "ambit_name": ambit.name,
                "score": ambit_score.score,
                "letter": ambit.letter,
                "color": ambit.color,
                "maturity_level": maturity.name if maturity else None,
                "maturity_color": maturity.color if maturity else None,
                "feedback": feedback
            })
        global_level = (
                self.db.query(MaturityLevel)
                .filter(
                    MaturityLevel.min_score <= evaluation.global_score,
                    MaturityLevel.max_score >= evaluation.global_score
                )
                .first()
            )
        return {
            "evaluation_id": evaluation.id,
            "date": evaluation.date,
            "global_score": evaluation.global_score,
            "global_maturity_level": global_level.name,
            "ambits": ambit_results
        }
        
    def get_evaluation_history(self, user_id: int):
        evaluations = (
            self.db.query(Evaluation)
            .filter(Evaluation.user_id == user_id)
            .order_by(Evaluation.id.asc())
            .all()
        )

        history = []
        ambit_accumulator = defaultdict(list)

        for ev in evaluations:
            ambits = (
                self.db.query(EvaluationAmbitScore)
                .filter(EvaluationAmbitScore.evaluation_id == ev.id)
                .all()
            )
            

            ambit_data = []

            for a in ambits:
                ambit_info = (self.db.query(Ambit).filter(Ambit.id == a.ambit_id).first())
                maturity_level = (
                    self.db.query(MaturityLevel)
                    .filter(
                        MaturityLevel.min_score <= a.score,
                        MaturityLevel.max_score >= a.score
                    )
                    .first()
                )
                ambit_data.append({
                    "ambit_name": ambit_info.name if ambit_info else None,
                    "ambit_color": maturity_level.color if maturity_level else None,
                    "ambit_id": a.ambit_id,
                    "score": a.score,
                    "date": ev.date
                })
                ambit_accumulator[a.ambit_id].append(a.score)

            history.append({
                "evaluation_id": ev.id,
                "date": ev.date,
                "global_score": ev.global_score,
                "ambits": ambit_data
            })
            
        ambit_averages = []
        
        for ambit_id, scores in ambit_accumulator.items():
            ambit_info = (self.db.query(Ambit).filter(Ambit.id == ambit_id).first())
            ambit_averages.append({
                "ambit_name": ambit_info.name,
                "ambit_id": ambit_id,
                "letter": ambit_info.letter,
                "ambit_color": ambit_info.color, 
                "score": sum(scores) / len(scores)
            
            })

        global_average = (
            sum(ev.global_score for ev in evaluations) / len(evaluations)
            if evaluations else 0
        )

        return {
            "history": history,
            "averages": {
                "global_score": global_average,
                "ambits": ambit_averages
            }
        }
