from collections import defaultdict
from datetime import date
from fastapi import HTTPException

from dateutil.relativedelta import relativedelta

from ..models.feedback_ambit_model import FeedbackAmbit

from ..models.user_model import User

from ..models.evaluation_ambit_score_model import EvaluationAmbitScore
from ..models.evaluation_indicator_response_model import EvaluationIndicatorResponse
from ..models.evaluation_model import Evaluation, EvaluationStatus
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
                        "id": answer.id,
                        "maturity_level_id": answer.maturity_level_id,
                        "maturity_name": ml.name if ml else None,
                        "value": ml.value if ml else None,
                        "text": answer.text
                    })
                indicator_data["answers"].sort(key=lambda x: x["value"])
                ambit_data["indicators"].append(indicator_data)

            result["ambits"].append(ambit_data)

        return result

    def save_draft(self, payload: dict, user_id: int):
        responses = payload["responses"]

        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(404, "User not found")

        self.validate_duplicate_indicators(responses)

        evaluation = (
            self.db.query(Evaluation)
            .filter(
                Evaluation.user_id == user_id,
                Evaluation.status == EvaluationStatus.DRAFT
            )
            .order_by(Evaluation.id.desc())
            .first()
        )

        if not evaluation:
            evaluation = Evaluation(
                user_id=user_id,
                date=date.today(),
                status=EvaluationStatus.DRAFT
            )
            self.db.add(evaluation)
            self.db.flush()
        else:
            self.db.query(EvaluationIndicatorResponse).filter(
                EvaluationIndicatorResponse.evaluation_id == evaluation.id
            ).delete(synchronize_session=False)

            self.db.query(EvaluationAmbitScore).filter(
                EvaluationAmbitScore.evaluation_id == evaluation.id
            ).delete(synchronize_session=False)

            evaluation.global_score = None

        for r in responses:
            indicator = self.get_indicator_or_error(r["indicator_id"])
            answer = self.get_indicator_answer_or_error(
                r["indicator_answer_id"]
                )

            self.validate_answer_belongs_to_indicator(
                indicator,
                answer
            )

            maturity = self.get_maturity_level_or_error(
                answer.maturity_level_id,
                answer.id
            )

            response = EvaluationIndicatorResponse(
                evaluation_id=evaluation.id,
                indicator_id=indicator.id,
                maturity_level_id=maturity.id,
                score=maturity.value
            )

            self.db.add(response)

        self.db.commit()

        return {
            "evaluation_id": evaluation.id,
            "status": evaluation.status.value
        }

    def submit_evaluation(self, payload: dict, user_id: int):
        responses = payload["responses"]
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(404, "User not found")

        self.validate_duplicate_indicators(responses)
        self.validate_evaluation_completeness(responses)

        evaluation = Evaluation(
            user_id=user_id,
            date=date.today(),
            status=EvaluationStatus.COMPLETED
        )

        self.db.add(evaluation)
        self.db.flush()


        ambit_scores = defaultdict(list)


        for r in responses:
            indicator = self.get_indicator_or_error(r["indicator_id"])
            answer = self.get_indicator_answer_or_error(
                r["indicator_answer_id"]
            )

            self.validate_answer_belongs_to_indicator(
                indicator,
                answer
            )

            maturity = self.get_maturity_level_or_error(
                answer.maturity_level_id,
                answer.id
            )

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
            maturity_level = self.get_maturity_level_for_score(avg_score)
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
            .filter(
                Evaluation.user_id == user_id,
                Evaluation.status == EvaluationStatus.COMPLETED
            )
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


            maturity = self.get_maturity_level_for_score(ambit_score.score)

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
        global_level = self.get_maturity_level_for_score(evaluation.global_score)
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
            .filter(
                Evaluation.user_id == user_id,
                Evaluation.status == EvaluationStatus.COMPLETED
            )
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
                maturity_level = self.get_maturity_level_for_score(a.score)
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
    def get_required_indicator_ids(self) -> set[int]:
        return {
            indicator_id
            for (indicator_id,) in self.db.query(Indicator.id).all()
        }

    def validate_duplicate_indicators(self, responses: list[dict]) -> None:
        seen_indicator_ids = set()
        duplicate_indicator_ids = set()

        for response in responses:
            indicator_id = response["indicator_id"]

            if indicator_id in seen_indicator_ids:
                duplicate_indicator_ids.add(indicator_id)
            else:
                seen_indicator_ids.add(indicator_id)

        if duplicate_indicator_ids:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Duplicate indicators are not allowed",
                    "duplicate_indicator_ids": sorted(duplicate_indicator_ids)
                }
            )

    def get_indicator_answer_or_error(
        self,
        indicator_answer_id: int
    ) -> IndicatorAnswer:
        answer = self.db.query(IndicatorAnswer).get(indicator_answer_id)

        if not answer:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Indicator answer not found",
                    "indicator_answer_id": indicator_answer_id
                }
            )

        return answer

    def get_indicator_or_error(self, indicator_id: int) -> Indicator:
        indicator = self.db.query(Indicator).get(indicator_id)

        if not indicator:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Indicator not found",
                    "indicator_id": indicator_id
                }
            )

        return indicator

    def validate_evaluation_completeness(self, responses: list[dict]) -> None:
        required_indicator_ids = self.get_required_indicator_ids()
        submitted_indicator_ids = {
            response["indicator_id"]
            for response in responses
        }

        missing_indicator_ids = required_indicator_ids - submitted_indicator_ids

        if missing_indicator_ids:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Evaluation is incomplete",
                    "missing_indicator_ids": sorted(missing_indicator_ids)
                }
            )

    def validate_answer_belongs_to_indicator(
        self,
        indicator: Indicator,
        answer: IndicatorAnswer
    ) -> None:
        if answer.indicator_id != indicator.id:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Indicator answer does not belong to indicator",
                    "indicator_id": indicator.id,
                    "indicator_answer_id": answer.id
                }
            )

    def get_maturity_level_for_score(
        self,
        score: float
    ) -> MaturityLevel:
        maturity_levels = (
            self.db.query(MaturityLevel)
            .order_by(MaturityLevel.min_score.asc())
            .all()
        )

        if not maturity_levels:
            raise HTTPException(
                status_code=500,
                detail="Maturity levels are not configured"
            )

        for index, maturity_level in enumerate(maturity_levels):
            is_last_level = index == len(maturity_levels) - 1

            if is_last_level:
                matches = (
                    maturity_level.min_score <= score
                    <= maturity_level.max_score
                )
            else:
                matches = (
                    maturity_level.min_score <= score
                    < maturity_level.max_score
                )

            if matches:
                return maturity_level

        raise HTTPException(
            status_code=500,
            detail=f"No maturity level configured for score {score}"
        )

    def get_maturity_level_or_error(
        self,
        maturity_level_id: int | None,
        indicator_answer_id: int
    ) -> MaturityLevel:
        if maturity_level_id is None:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Indicator answer has no maturity level",
                    "indicator_answer_id": indicator_answer_id
                }
            )

        maturity = self.db.query(MaturityLevel).get(
            maturity_level_id
        )

        if not maturity:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Maturity level not found for indicator answer",
                    "indicator_answer_id": indicator_answer_id,
                    "maturity_level_id": maturity_level_id
                }
            )

        return maturity
