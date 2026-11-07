
from datetime import datetime

import pytest

from app.models.evaluation_model import Evaluation, EvaluationStatus
from app.models.evaluation_ambit_score_model import EvaluationAmbitScore
from app.services.evaluations_service import EvaluationService
from tests.test_evaluation import create_evaluation_data
from app.models.methodology_model import Methodology, MethodologyStatus

from app.models.user_model import User
from app.core.roles import UserRole

from app.main import app
from app.services.token_service import get_current_user

from app.models.company_model import Company
from app.models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)

@pytest.fixture
def dashboard_data(db_session):
    data = create_evaluation_data(db_session)

    first = Evaluation(
        user_id=data["user"].id,
        company_id=data["company"].id,
        methodology_id=data["methodology"].id,
        status=EvaluationStatus.COMPLETED,
        date=datetime(2026, 1, 15),
        global_score=7.0,
    )

    second = Evaluation(
        user_id=data["user"].id,
        company_id=data["company"].id,
        methodology_id=data["methodology"].id,
        status=EvaluationStatus.COMPLETED,
        date=datetime(2026, 4, 15),
        global_score=8.0,
    )

    db_session.add_all([first, second])
    db_session.flush()

    for evaluation, scores in [
        (first, [6.0, 7.0, 8.0]),
        (second, [7.0, 8.0, 9.0]),
    ]:
        db_session.add_all([
            EvaluationAmbitScore(
                evaluation_id=evaluation.id,
                ambit_id=ambit.id,
                score=score,
                maturity_level_id=data["maturity_levels"][0].id,
            )
            for ambit, score in zip(data["ambits"], scores)
        ])

    db_session.flush()

    return {
        **data,
        "first": first,
        "second": second,
    }


def test_dashboard_returns_chronological_history_and_deltas(
    db_session,
    dashboard_data,
):
    data = dashboard_data

    result = EvaluationService(
        db_session
    ).get_historical_dashboard(data["user"].id)

    history = result["history"]

    assert len(history) == 2

    assert [
        item["evaluation_id"]
        for item in history
    ] == [
        data["first"].id,
        data["second"].id,
    ]

    assert [
        item["global_score"]
        for item in history
    ] == [7.0, 8.0]

    assert history[0]["global_delta"] is None
    assert history[1]["global_delta"] == pytest.approx(1.0)

    assert all(
        item["methodology_id"] == data["methodology"].id
        for item in history
    )

    assert all(
        item["methodology_version"]
        == data["methodology"].version
        for item in history
    )

    first_ambits = {
        ambit["ambit_id"]: ambit
        for ambit in history[0]["ambits"]
    }

    second_ambits = {
        ambit["ambit_id"]: ambit
        for ambit in history[1]["ambits"]
    }

    for ambit in data["ambits"]:
        assert first_ambits[ambit.id]["delta"] is None
        assert second_ambits[ambit.id]["delta"] == pytest.approx(1.0)


def test_dashboard_does_not_compare_different_methodologies(
    db_session,
    dashboard_data,
):
    data = dashboard_data

    second_methodology = Methodology(
        name="Second Dashboard Methodology",
        version="TEST-DASHBOARD-2",
        status=MethodologyStatus.PUBLISHED,
        is_active=False,
    )

    db_session.add(second_methodology)
    db_session.flush()

    third = Evaluation(
        user_id=data["user"].id,
        company_id=data["company"].id,
        methodology_id=second_methodology.id,
        status=EvaluationStatus.COMPLETED,
        date=datetime(2026, 7, 15),
        global_score=9.0,
    )

    db_session.add(third)
    db_session.flush()

    result = EvaluationService(
        db_session
    ).get_historical_dashboard(data["user"].id)

    history = result["history"]

    assert len(history) == 3

    assert [
        item["evaluation_id"]
        for item in history
    ] == [
        data["first"].id,
        data["second"].id,
        third.id,
    ]

    assert history[1]["global_delta"] == pytest.approx(1.0)

    assert history[2]["methodology_id"] == second_methodology.id
    assert history[2]["methodology_version"] == "TEST-DASHBOARD-2"
    assert history[2]["global_score"] == pytest.approx(9.0)
    assert history[2]["global_delta"] is None
    assert history[2]["ambits"] == []


def test_dashboard_excludes_drafts(
    db_session,
    dashboard_data,
):
    data = dashboard_data

    draft = Evaluation(
        user_id=data["user"].id,
        company_id=data["company"].id,
        methodology_id=data["methodology"].id,
        status=EvaluationStatus.DRAFT,
        date=datetime(2026, 5, 15),
        global_score=None,
    )

    other_user_evaluation = Evaluation(
        user_id=data["user"].id + 999,
        methodology_id=data["methodology"].id,
        status=EvaluationStatus.COMPLETED,
        date=datetime(2026, 6, 15),
        global_score=9.5,
    )

    db_session.add(draft)
    db_session.flush()

    result = EvaluationService(
        db_session
    ).get_historical_dashboard(data["user"].id)

    assert [
        item["evaluation_id"]
        for item in result["history"]
    ] == [
        data["first"].id,
        data["second"].id,
    ]

def test_dashboard_endpoint_requires_authentication(client):
    response = client.get(
        "/api/evaluations/dashboard/history/me"
    )

    assert response.status_code == 401


def test_dashboard_isolates_evaluations_by_user(
    db_session,
    dashboard_data,
):
    data = dashboard_data

    other_user = User(
        name="Other",
        lastname="User",
        position="Tester",
        company_name="Other Dashboard Company",
        email="other-dashboard-user@test.local",
        phone="9999999998",
        password="test-password",
        role=UserRole.USER,
        active=True,
    )

    db_session.add(other_user)
    db_session.flush()

    other_company = Company(
        name="Other Dashboard Company",
        active=True,
    )

    db_session.add(other_company)
    db_session.flush()

    other_membership = CompanyMembership(
        user_id=other_user.id,
        company_id=other_company.id,
        status=CompanyMembershipStatus.ACTIVE,
    )

    db_session.add(other_membership)
    db_session.flush()

    other_evaluation = Evaluation(
        user_id=other_user.id,
        company_id=other_company.id,
        methodology_id=data["methodology"].id,
        status=EvaluationStatus.COMPLETED,
        date=datetime(2026, 6, 15),
        global_score=9.5,
    )

    db_session.add(other_evaluation)
    db_session.flush()

    service = EvaluationService(db_session)

    original_history = service.get_historical_dashboard(
        data["user"].id
    )["history"]

    other_history = service.get_historical_dashboard(
        other_user.id
    )["history"]

    assert [
        item["evaluation_id"]
        for item in original_history
    ] == [
        data["first"].id,
        data["second"].id,
    ]

    assert [
        item["evaluation_id"]
        for item in other_history
    ] == [
        other_evaluation.id,
    ]

    assert other_history[0]["global_score"] == pytest.approx(9.5)
    assert other_history[0]["global_delta"] is None


def test_dashboard_handles_null_global_score(
    db_session,
    dashboard_data,
):
    data = dashboard_data

    data["second"].global_score = None
    db_session.flush()

    result = EvaluationService(
        db_session
    ).get_historical_dashboard(data["user"].id)

    history = result["history"]

    assert len(history) == 2

    assert history[0]["global_score"] == pytest.approx(7.0)
    assert history[0]["global_delta"] is None

    assert history[1]["global_score"] is None
    assert history[1]["global_delta"] is None

    assert all(
        ambit["delta"] is None
        for ambit in history[1]["ambits"]
    )


def test_dashboard_endpoint_returns_authenticated_user_history(
    client,
    dashboard_data,
):
    data = dashboard_data

    app.dependency_overrides[get_current_user] = (
        lambda: data["user"]
    )

    try:
        response = client.get(
            "/api/evaluations/dashboard/history/me"
        )

        assert response.status_code == 200

        result = response.json()
        history = result["history"]

        assert len(history) == 2

        assert [
            item["evaluation_id"]
            for item in history
        ] == [
            data["first"].id,
            data["second"].id,
        ]

        assert [
            item["global_score"]
            for item in history
        ] == [7.0, 8.0]

        assert history[0]["global_delta"] is None
        assert history[1]["global_delta"] == pytest.approx(1.0)

        assert all(
            item["methodology_id"] == data["methodology"].id
            for item in history
        )

        assert all(
            item["methodology_version"]
            == data["methodology"].version
            for item in history
        )

        assert all(
            len(item["ambits"]) == 3
            for item in history
        )

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_dashboard_does_not_calculate_deltas_for_incompatible_ambits(
    db_session,
    dashboard_data,
):
    data = dashboard_data

    ambit_to_remove = data["ambits"][2]

    db_session.query(EvaluationAmbitScore).filter(
        EvaluationAmbitScore.evaluation_id == data["second"].id,
        EvaluationAmbitScore.ambit_id == ambit_to_remove.id,
    ).delete(synchronize_session=False)

    db_session.flush()

    result = EvaluationService(
        db_session
    ).get_historical_dashboard(data["user"].id)

    history = result["history"]

    assert len(history) == 2

    assert history[0]["global_score"] == pytest.approx(7.0)
    assert history[1]["global_score"] == pytest.approx(8.0)

    assert len(history[0]["ambits"]) == 3
    assert len(history[1]["ambits"]) == 2

    assert history[1]["global_delta"] is None

    assert all(
        ambit["delta"] is None
        for ambit in history[1]["ambits"]
    )

def test_dashboard_returns_empty_history(db_session):
    data = create_evaluation_data(db_session)

    result = EvaluationService(
        db_session
    ).get_historical_dashboard(data["user"].id)

    assert result == {"history": []}