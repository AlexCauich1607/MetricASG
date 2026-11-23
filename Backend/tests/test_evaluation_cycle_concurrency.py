
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy.orm import sessionmaker

from app.core.roles import CompanyRole, UserRole
from app.models.ambit_model import Ambit
from app.models.audit_log_model import AuditLog
from app.models.company_model import Company
from app.models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)
from app.models.evaluation_ambit_score_model import EvaluationAmbitScore
from app.models.evaluation_indicator_response_model import (
    EvaluationIndicatorResponse,
)
from app.models.evaluation_model import Evaluation, EvaluationStatus
from app.models.indicator_answer_model import IndicatorAnswer
from app.models.indicator_model import Indicator
from app.models.maturity_level_model import MaturityLevel
from app.models.methodology_model import Methodology, MethodologyStatus
from app.models.user_model import User
from app.services.evaluations_service import EvaluationService
from app.services.methodology_service import MethodologyService
from tests.conftest import engine


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def test_concurrent_company_submissions_allow_only_one():
    assert engine.url.database == "metricasg_test_db"

    unique_id = uuid.uuid4().hex
    barrier = Barrier(2)
    ids = {}
    results = []

    try:
        # Los datos deben estar confirmados antes de usar
        # las dos conexiones independientes.
        with SessionLocal.begin() as db:
            methodology = Methodology(
                name=f"Concurrent cycle {unique_id}",
                version=f"CONCURRENT-{unique_id}",
                status=MethodologyStatus.PUBLISHED,
                is_active=False,
            )
            db.add(methodology)
            db.flush()
            ids["methodology"] = methodology.id

            ambit = Ambit(
                name="Test ambit",
                description="",
                letter="A",
                color="#37AB48",
                is_removable=False,
                methodology_id=methodology.id,
            )
            db.add(ambit)
            db.flush()
            ids["ambit"] = ambit.id

            maturity = MaturityLevel(
                name="Intermedio",
                value=8,
                description="",
                min_score=0,
                max_score=10,
                color="#13b46e",
                is_removable=False,
                methodology_id=methodology.id,
            )
            db.add(maturity)
            db.flush()

            indicator = Indicator(
                ambit_id=ambit.id,
                question="Concurrent evaluation indicator",
            )
            db.add(indicator)
            db.flush()
            ids["indicator"] = indicator.id

            # Si el evento after_insert crea respuestas,
            # reutilizamos una compatible con este nivel.
            answer = (
                db.query(IndicatorAnswer)
                .filter(
                    IndicatorAnswer.indicator_id == indicator.id,
                    IndicatorAnswer.maturity_level_id == maturity.id,
                )
                .first()
            )

            if answer is None:
                answer = IndicatorAnswer(
                    indicator_id=indicator.id,
                    maturity_level_id=maturity.id,
                    text="Concurrent test answer",
                )
                db.add(answer)
                db.flush()

            ids["answer"] = answer.id

            company = Company(
                name=f"Concurrent company {unique_id}",
                active=True,
            )
            db.add(company)
            db.flush()
            ids["company"] = company.id

            ids["users"] = []

            for number in (1, 2):
                user = User(
                    name=f"Concurrent {number}",
                    lastname="Evaluator",
                    position="ASG Manager",
                    email=f"concurrent-{number}-{unique_id}@test.local",
                    phone="9999999999",
                    password="test-password",
                    role=UserRole.USER,
                    active=True,
                )
                db.add(user)
                db.flush()

                ids["users"].append(user.id)

                db.add(
                    CompanyMembership(
                        user_id=user.id,
                        company_id=company.id,
                        role=CompanyRole.ASG_MANAGER,
                        status=CompanyMembershipStatus.ACTIVE,
                    )
                )

        def select_test_methodology(service):
            return service.db.get(
                Methodology,
                ids["methodology"],
            )

        def submit(user_id):
            with SessionLocal() as db:
                payload = {
                    "company_id": ids["company"],
                    "responses": [
                        {
                            "indicator_id": ids["indicator"],
                            "indicator_answer_id": ids["answer"],
                        }
                    ],
                }

                barrier.wait(timeout=10)

                try:
                    EvaluationService(db).submit_evaluation(
                        payload,
                        user_id,
                    )
                    return 200

                except HTTPException as exc:
                    db.rollback()
                    return exc.status_code

        # El patch solo se usa en esta prueba aislada.
        with patch.object(
            MethodologyService,
            "get_active",
            select_test_methodology,
        ):
            with ThreadPoolExecutor(max_workers=2) as executor:
                futures = [
                    executor.submit(submit, user_id)
                    for user_id in ids["users"]
                ]

                results = [
                    future.result(timeout=30)
                    for future in futures
                ]

        assert sorted(results) == [200, 409]

        with SessionLocal() as db:
            completed = (
                db.query(Evaluation)
                .filter(
                    Evaluation.company_id == ids["company"],
                    Evaluation.status == EvaluationStatus.COMPLETED,
                )
                .all()
            )

            audits = (
                db.query(AuditLog)
                .filter(
                    AuditLog.company_id == ids["company"],
                    AuditLog.action == "evaluation.submitted",
                )
                .all()
            )

            company = db.get(Company, ids["company"])

            assert len(completed) == 1
            assert len(audits) == 1
            assert audits[0].resource_id == completed[0].id
            assert company.biannual_evaluation is True
            assert company.next_evaluation is not None

    finally:
        # Limpiar únicamente registros de esta prueba.
        if ids.get("company") is not None:
            with SessionLocal.begin() as db:
                db.query(AuditLog).filter(
                    AuditLog.company_id == ids["company"],
                ).delete(synchronize_session=False)

                evaluation_ids = [
                    row[0]
                    for row in db.query(Evaluation.id)
                    .filter(Evaluation.company_id == ids["company"])
                    .all()
                ]

                if evaluation_ids:
                    db.query(EvaluationIndicatorResponse).filter(
                        EvaluationIndicatorResponse.evaluation_id.in_(
                            evaluation_ids
                        )
                    ).delete(synchronize_session=False)

                    db.query(EvaluationAmbitScore).filter(
                        EvaluationAmbitScore.evaluation_id.in_(
                            evaluation_ids
                        )
                    ).delete(synchronize_session=False)

                    db.query(Evaluation).filter(
                        Evaluation.id.in_(evaluation_ids)
                    ).delete(synchronize_session=False)

                db.query(CompanyMembership).filter(
                    CompanyMembership.company_id == ids["company"]
                ).delete(synchronize_session=False)

                db.query(User).filter(
                    User.id.in_(ids["users"])
                ).delete(synchronize_session=False)

                db.query(Company).filter(
                    Company.id == ids["company"]
                ).delete(synchronize_session=False)

        if ids.get("methodology") is not None:
            with SessionLocal.begin() as db:
                db.query(IndicatorAnswer).filter(
                    IndicatorAnswer.indicator_id == ids["indicator"]
                ).delete(synchronize_session=False)

                db.query(Indicator).filter(
                    Indicator.id == ids["indicator"]
                ).delete(synchronize_session=False)

                db.query(Ambit).filter(
                    Ambit.methodology_id == ids["methodology"]
                ).delete(synchronize_session=False)

                db.query(MaturityLevel).filter(
                    MaturityLevel.methodology_id == ids["methodology"]
                ).delete(synchronize_session=False)

                db.query(Methodology).filter(
                    Methodology.id == ids["methodology"]
                ).delete(synchronize_session=False)
