from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.ambit_model import Ambit
from app.models.company_model import Company
from app.models.evaluation_ambit_score_model import EvaluationAmbitScore
from app.models.evaluation_model import Evaluation, EvaluationStatus


class BenchmarkService:
    MIN_GROUP_SIZE = 5

    def __init__(self, db: Session):
        self.db = db

    def get_aggregated_results(
        self,
        company_id: int,
        methodology_id: int,
        sector_id: int | None = None,
        size_id: int | None = None,
    ) -> dict:
        latest_evaluations = (
            self.db.query(
                Evaluation.company_id.label("company_id"),
                func.max(Evaluation.id).label("evaluation_id"),
            )
            .join(
                Company,
                Company.id == Evaluation.company_id,
            )
            .filter(
                Company.active.is_(True),
                Company.id != company_id,
                Evaluation.status == EvaluationStatus.COMPLETED,
                Evaluation.methodology_id == methodology_id,
            )
        )

        if sector_id is not None:
            latest_evaluations = latest_evaluations.filter(
                Company.sector_id == sector_id,
            )

        if size_id is not None:
            latest_evaluations = latest_evaluations.filter(
                Company.size_id == size_id,
            )

        latest_evaluations = (
            latest_evaluations
            .group_by(Evaluation.company_id)
            .subquery()
        )

        eligible_evaluations = (
            self.db.query(
                Evaluation.id.label("evaluation_id"),
                Evaluation.company_id.label("company_id"),
                Evaluation.global_score.label("global_score"),
            )
            .join(
                latest_evaluations,
                Evaluation.id == latest_evaluations.c.evaluation_id,
            )
            .filter(Evaluation.global_score.isnot(None))
            .subquery()
        )

        global_stats = (
            self.db.query(
                func.count(
                    func.distinct(eligible_evaluations.c.company_id)
                ),
                func.avg(eligible_evaluations.c.global_score),
            )
            .one()
        )

        company_count = global_stats[0]

        if company_count < self.MIN_GROUP_SIZE:
            return {
                "available": False,
                "methodology_id": methodology_id,
                "global_average": None,
                "ambits": [],
            }

        ambit_rows = (
            self.db.query(
                Ambit.id,
                Ambit.name,
                Ambit.letter,
                func.count(
                    func.distinct(eligible_evaluations.c.company_id)
                ).label("company_count"),
                func.avg(EvaluationAmbitScore.score).label("average"),
            )
            .join(
                EvaluationAmbitScore,
                EvaluationAmbitScore.ambit_id == Ambit.id,
            )
            .join(
                eligible_evaluations,
                eligible_evaluations.c.evaluation_id
                == EvaluationAmbitScore.evaluation_id,
            )
            .filter(Ambit.methodology_id == methodology_id)
            .group_by(Ambit.id, Ambit.name, Ambit.letter)
            .order_by(Ambit.id)
            .all()
        )

        ambits = [
            {
                "ambit_id": row.id,
                "name": row.name,
                "letter": row.letter,
                "average": float(row.average),
            }
            for row in ambit_rows
            if (
                row.company_count >= self.MIN_GROUP_SIZE
                and row.average is not None
            )
        ]

        return {
            "available": True,
            "methodology_id": methodology_id,
            "global_average": float(global_stats[1]),
            "ambits": ambits,
        }
