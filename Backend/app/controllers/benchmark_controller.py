from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.company_permissions import require_company_role
from app.core.roles import CompanyRole
from app.database.database import get_db
from app.models.company_model import Company
from app.models.evaluation_model import Evaluation, EvaluationStatus
from app.models.user_model import User
from app.services.benchmark_service import BenchmarkService
from app.services.token_service import get_current_user


class BenchmarkController:

    def __init__(self):
        self.router = APIRouter(
            prefix="/api/benchmark",
            tags=["Benchmark"],
            dependencies=[Depends(get_current_user)],
        )

        @self.router.get("")
        def get_benchmark(
            company_id: int = Query(..., gt=0),
            methodology_id: int = Query(..., gt=0),
            sector_id: int | None = Query(None, gt=0),
            size_id: int | None = Query(None, gt=0),
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            require_company_role(
                db,
                current_user,
                company_id,
                CompanyRole.COMPANY_ADMIN,
                CompanyRole.ASG_MANAGER,
                CompanyRole.COLLABORATOR,
                CompanyRole.AUDITOR,
            )

            company = (
                db.query(Company)
                .filter(
                    Company.id == company_id,
                    Company.active.is_(True),
                )
                .first()
            )

            if company is None:
                raise HTTPException(
                    status_code=404,
                    detail="Company not found",
                )

            if company.sector_id is None or company.size_id is None:
                raise HTTPException(
                    status_code=422,
                    detail="Company sector and size are required for benchmarking",
                )

            if (
                sector_id is not None
                and sector_id != company.sector_id
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Sector does not match company",
                )

            if (
                size_id is not None
                and size_id != company.size_id
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Size does not match company",
                )

            own_evaluation = (
                db.query(Evaluation)
                .filter(
                    Evaluation.company_id == company_id,
                    Evaluation.user_id == current_user.id,
                    Evaluation.methodology_id == methodology_id,
                    Evaluation.status == EvaluationStatus.COMPLETED,
                    Evaluation.global_score.isnot(None),
                )
                .first()
            )

            if own_evaluation is None:
                raise HTTPException(
                    status_code=404,
                    detail="No eligible evaluation found",
                )

            return BenchmarkService(db).get_aggregated_results(
                company_id=company_id,
                methodology_id=methodology_id,
                sector_id=company.sector_id,
                size_id=company.size_id,
            )
