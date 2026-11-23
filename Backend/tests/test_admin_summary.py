import pytest

from app.models.company_model import Company

from datetime import datetime

from app.models.evaluation_model import (
    Evaluation,
    EvaluationStatus,
)
from app.services.admin_service import AdminService
from tests.test_evaluation import create_evaluation_data
from app.models.evaluation_ambit_score_model import EvaluationAmbitScore

def test_admin_summary_counts_companies_not_evaluations(db_session):
    data = create_evaluation_data(db_session)

    company = data["company"]
    user = data["user"]
    methodology = data["methodology"]

    service = AdminService()

    # La empresa existe, pero todavía no ha completado
    # ningún diagnóstico.
    initial = service.get_summary(db_session)

    db_session.add(
        Evaluation(
            user_id=user.id,
            company_id=company.id,
            methodology_id=methodology.id,
            status=EvaluationStatus.COMPLETED,
            date=datetime(2026, 1, 15),
            global_score=6.0,
        )
    )
    db_session.flush()

    first = service.get_summary(db_session)

    assert (
        first["companies"]["completed_evaluation"]
        == initial["companies"]["completed_evaluation"] + 1
    )
    assert (
        first["companies"]["pending_evaluation"]
        == initial["companies"]["pending_evaluation"] - 1
    )

    # Una segunda evaluación de la misma empresa
    # no debe aumentar el número de empresas evaluadas.
    db_session.add(
        Evaluation(
            user_id=user.id,
            company_id=company.id,
            methodology_id=methodology.id,
            status=EvaluationStatus.COMPLETED,
            date=datetime(2026, 7, 15),
            global_score=9.0,
        )
    )
    db_session.flush()

    second = service.get_summary(db_session)

    assert second["companies"] == first["companies"]
    assert second["users"]["total"] == first["users"]["total"]

    # Un borrador tampoco debe alterar los conteos.
    db_session.add(
        Evaluation(
            user_id=user.id,
            company_id=company.id,
            methodology_id=methodology.id,
            status=EvaluationStatus.DRAFT,
            date=datetime(2026, 8, 15),
        )
    )
    db_session.flush()

    third = service.get_summary(db_session)

    assert third["companies"] == second["companies"]

def test_admin_summary_uses_latest_completed_score_per_company(
    db_session,
):
    data = create_evaluation_data(db_session)

    company = data["company"]
    user = data["user"]
    methodology = data["methodology"]

    first = Evaluation(
        user_id=user.id,
        company_id=company.id,
        methodology_id=methodology.id,
        status=EvaluationStatus.COMPLETED,
        date=datetime(2026, 1, 15),
        global_score=6.0,
    )

    second = Evaluation(
        user_id=user.id,
        company_id=company.id,
        methodology_id=methodology.id,
        status=EvaluationStatus.COMPLETED,
        date=datetime(2026, 7, 15),
        global_score=9.0,
    )

    draft = Evaluation(
        user_id=user.id,
        company_id=company.id,
        methodology_id=methodology.id,
        status=EvaluationStatus.DRAFT,
        date=datetime(2026, 8, 15),
        global_score=10.0,
    )

    db_session.add_all([first, second, draft])
    db_session.flush()

    # Calcular el resultado esperado de manera independiente:
    # seleccionar la última evaluación COMPLETED de cada
    # empresa activa y promediar sus puntuaciones.
    active_company_ids = {
        company_id
        for (company_id,) in (
            db_session.query(Company.id)
            .filter(Company.active.is_(True))
            .all()
        )
    }

    completed = (
        db_session.query(Evaluation)
        .filter(
            Evaluation.company_id.in_(active_company_ids),
            Evaluation.status == EvaluationStatus.COMPLETED,
        )
        .order_by(
            Evaluation.date.desc().nullslast(),
            Evaluation.id.desc(),
        )
        .all()
    )

    latest_by_company = {}

    for evaluation in completed:
        latest_by_company.setdefault(
            evaluation.company_id,
            evaluation,
        )

    assert latest_by_company[company.id].id == second.id

    scores = [
        float(evaluation.global_score)
        for evaluation in latest_by_company.values()
        if evaluation.global_score is not None
    ]

    expected_average = (
        round(sum(scores) / len(scores), 2)
        if scores
        else 0
    )

    summary = AdminService().get_summary(db_session)

    assert summary["asg"]["global_average"] == pytest.approx(
        expected_average
    )


def test_admin_summary_uses_latest_company_maturity_distribution(
    db_session,
):
    data = create_evaluation_data(db_session)

    company = data["company"]
    user = data["user"]
    methodology = data["methodology"]

    ambit = data["ambits"][0]
    basic = data["maturity_levels"][0]
    intermediate = data["maturity_levels"][1]
    advanced = data["maturity_levels"][2]

    service = AdminService()

    initial = service.get_summary(db_session)

    def get_count(summary, ambit_id, maturity_id):
        for item in summary["ambits"]:
            if item["id"] == ambit_id:
                for level in item["maturity_levels"]:
                    if level["id"] == maturity_id:
                        return level["user_count"]
        return 0

    initial_basic = get_count(initial, ambit.id, basic.id)
    initial_intermediate = get_count(
        initial, ambit.id, intermediate.id
    )
    initial_advanced = get_count(
        initial, ambit.id, advanced.id
    )

    # Primera evaluación completada: nivel Básico.
    first = Evaluation(
        user_id=user.id,
        company_id=company.id,
        methodology_id=methodology.id,
        status=EvaluationStatus.COMPLETED,
        date=datetime(2026, 1, 15),
        global_score=6.0,
    )
    db_session.add(first)
    db_session.flush()

    db_session.add(
        EvaluationAmbitScore(
            evaluation_id=first.id,
            ambit_id=ambit.id,
            score=6.0,
            maturity_level_id=basic.id,
        )
    )
    db_session.flush()

    after_first = service.get_summary(db_session)

    assert get_count(
        after_first, ambit.id, basic.id
    ) == initial_basic + 1

    # Nueva evaluación completada:
    # la empresa pasa a nivel Avanzado.
    second = Evaluation(
        user_id=user.id,
        company_id=company.id,
        methodology_id=methodology.id,
        status=EvaluationStatus.COMPLETED,
        date=datetime(2026, 7, 15),
        global_score=10.0,
    )
    db_session.add(second)
    db_session.flush()

    db_session.add(
        EvaluationAmbitScore(
            evaluation_id=second.id,
            ambit_id=ambit.id,
            score=10.0,
            maturity_level_id=advanced.id,
        )
    )
    db_session.flush()

    after_second = service.get_summary(db_session)

    # La empresa ya no debe aparecer en Básico.
    assert get_count(
        after_second, ambit.id, basic.id
    ) == initial_basic

    # Solamente debe contar en Avanzado.
    assert get_count(
        after_second, ambit.id, advanced.id
    ) == initial_advanced + 1

    # Un borrador posterior no debe alterar la distribución.
    draft = Evaluation(
        user_id=user.id,
        company_id=company.id,
        methodology_id=methodology.id,
        status=EvaluationStatus.DRAFT,
        date=datetime(2026, 8, 15),
        global_score=8.0,
    )
    db_session.add(draft)
    db_session.flush()

    db_session.add(
        EvaluationAmbitScore(
            evaluation_id=draft.id,
            ambit_id=ambit.id,
            score=8.0,
            maturity_level_id=intermediate.id,
        )
    )
    db_session.flush()

    after_draft = service.get_summary(db_session)

    assert get_count(
        after_draft, ambit.id, basic.id
    ) == initial_basic

    assert get_count(
        after_draft, ambit.id, intermediate.id
    ) == initial_intermediate

    assert get_count(
        after_draft, ambit.id, advanced.id
    ) == initial_advanced + 1
