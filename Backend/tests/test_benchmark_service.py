from uuid import uuid4

import pytest

from app.core.roles import CompanyRole, UserRole
from app.models.company_model import Company
from app.models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)
from app.models.company_sector_model import CompanySector
from app.models.company_sizes_model import CompanySize
from app.models.evaluation_ambit_score_model import EvaluationAmbitScore
from app.models.evaluation_model import Evaluation, EvaluationStatus
from app.models.methodology_model import Methodology, MethodologyStatus
from app.models.user_model import User
from app.services.benchmark_service import BenchmarkService
from tests.test_evaluation import create_evaluation_data


@pytest.fixture
def benchmark_data(db_session):
    data = create_evaluation_data(db_session)

    sector = CompanySector(name=f"Sector-{uuid4().hex}")
    other_sector = CompanySector(name=f"Sector-{uuid4().hex}")
    size = CompanySize(name=f"Size-{uuid4().hex}")
    other_size = CompanySize(name=f"Size-{uuid4().hex}")

    db_session.add_all([
        sector, other_sector, size, other_size
    ])
    db_session.flush()

    data["company"].sector_id = sector.id
    data["company"].size_id = size.id
    db_session.flush()

    return {
        **data,
        "sector": sector,
        "other_sector": other_sector,
        "size": size,
        "other_size": other_size,
    }


def create_peer(
    db_session,
    data,
    global_score,
    *,
    sector_id=None,
    size_id=None,
    methodology_id=None,
    status=EvaluationStatus.COMPLETED,
    active=True,
    ambit_scores=None,
):
    identifier = uuid4().hex

    user = User(
        name="Benchmark",
        lastname="Test",
        position="Tester",
        company_name=f"Benchmark Company {identifier}",
        email=f"benchmark-{identifier}@test.local",
        phone="9999999999",
        password="test-password",
        role=UserRole.USER,
        active=True,
    )

    db_session.add(user)
    db_session.flush()

    company = Company(
        name=user.company_name,
        sector_id=(
            sector_id if sector_id is not None
            else data["sector"].id
        ),
        size_id=(
            size_id if size_id is not None
            else data["size"].id
        ),
        active=active,
    )

    db_session.add(company)
    db_session.flush()

    db_session.add(
        CompanyMembership(
            user_id=user.id,
            company_id=company.id,
            role=CompanyRole.ASG_MANAGER,
            status=CompanyMembershipStatus.ACTIVE,
        )
    )

    evaluation = Evaluation(
        user_id=user.id,
        company_id=company.id,
        methodology_id=(
            methodology_id
            if methodology_id is not None
            else data["methodology"].id
        ),
        status=status,
        global_score=global_score,
    )

    db_session.add(evaluation)
    db_session.flush()

    if ambit_scores is not None:
        for ambit, score in zip(data["ambits"], ambit_scores):
            db_session.add(
                EvaluationAmbitScore(
                    evaluation_id=evaluation.id,
                    ambit_id=ambit.id,
                    score=score,
                    maturity_level_id=data["maturity_levels"][0].id,
                )
            )

    db_session.flush()

    return company, evaluation


def get_results(db_session, data, **filters):
    return BenchmarkService(db_session).get_aggregated_results(
        company_id=data["company"].id,
        methodology_id=data["methodology"].id,
        **filters,
    )


def test_benchmark_aggregates_one_evaluation_per_company(
    db_session, benchmark_data
):
    data = benchmark_data

    peers = [
        create_peer(
            db_session, data, score,
            ambit_scores=[score, score + 0.1, score + 0.2],
        )
        for score in [6, 7, 8, 9, 10]
    ]

    # An older evaluation must not affect the average.
    company, latest = peers[0]
    latest.global_score = 6.0

    older = Evaluation(
        user_id=latest.user_id,
        company_id=company.id,
        methodology_id=data["methodology"].id,
        status=EvaluationStatus.COMPLETED,
        global_score=1.0,
    )
    # The service orders by ID, so this new record is the latest.
    db_session.add(older)
    db_session.flush()

    # Restore a newer evaluation with the intended score.
    newest = Evaluation(
        user_id=latest.user_id,
        company_id=company.id,
        methodology_id=data["methodology"].id,
        status=EvaluationStatus.COMPLETED,
        global_score=6.0,
    )
    db_session.add(newest)
    db_session.flush()

    for ambit, score in zip(data["ambits"], [6.0, 6.1, 6.2]):
        db_session.add(
            EvaluationAmbitScore(
                evaluation_id=newest.id,
                ambit_id=ambit.id,
                score=score,
                maturity_level_id=data["maturity_levels"][0].id,
            )
        )

    # The requesting company's results must not be included.
    db_session.add(
        Evaluation(
            user_id=data["user"].id,
            company_id=data["company"].id,
            methodology_id=data["methodology"].id,
            status=EvaluationStatus.COMPLETED,
            global_score=1.0,
        )
    )
    db_session.flush()

    result = get_results(db_session, data)

    assert result["available"] is True
    assert result["global_average"] == pytest.approx(8.0)
    assert len(result["ambits"]) == 3

    averages = {
        item["letter"]: item["average"]
        for item in result["ambits"]
    }

    assert averages["A"] == pytest.approx(8.0)
    assert averages["S"] == pytest.approx(8.1)
    assert averages["G"] == pytest.approx(8.2)


def test_benchmark_suppresses_small_groups(
    db_session, benchmark_data
):
    data = benchmark_data

    for score in [6, 7, 8, 9]:
        create_peer(db_session, data, score)

    result = get_results(db_session, data)

    assert result["available"] is False
    assert result["global_average"] is None
    assert result["ambits"] == []


def test_benchmark_applies_sector_and_size_filters(
    db_session, benchmark_data
):
    data = benchmark_data

    for score in [6, 7, 8, 9, 10]:
        create_peer(db_session, data, score)

    create_peer(
        db_session, data, 1.0,
        sector_id=data["other_sector"].id,
    )
    create_peer(
        db_session, data, 1.0,
        size_id=data["other_size"].id,
    )

    result = get_results(
        db_session,
        data,
        sector_id=data["sector"].id,
        size_id=data["size"].id,
    )

    assert result["available"] is True
    assert result["global_average"] == pytest.approx(8.0)


def test_benchmark_excludes_invalid_evaluations(
    db_session, benchmark_data
):
    data = benchmark_data

    for score in [6, 7, 8, 9]:
        create_peer(db_session, data, score)

    create_peer(
        db_session, data, 10.0,
        status=EvaluationStatus.DRAFT,
    )
    create_peer(
        db_session, data, 10.0,
        active=False,
    )

    other_methodology = Methodology(
        name="Other Benchmark Methodology",
        version=f"BENCH-{uuid4().hex}",
        status=MethodologyStatus.PUBLISHED,
        is_active=False,
    )
    db_session.add(other_methodology)
    db_session.flush()

    create_peer(
        db_session, data, 10.0,
        methodology_id=other_methodology.id,
    )

    result = get_results(db_session, data)

    assert result["available"] is False

    create_peer(db_session, data, 10.0)

    result = get_results(db_session, data)

    assert result["available"] is True
    assert result["global_average"] == pytest.approx(8.0)


def test_benchmark_suppresses_ambits_with_insufficient_data(
    db_session, benchmark_data
):
    data = benchmark_data

    for score in [6, 7, 8, 9]:
        create_peer(
            db_session, data, score,
            ambit_scores=[score, score, score],
        )

    create_peer(
        db_session, data, 10,
        ambit_scores=[10.0],
    )

    result = get_results(db_session, data)

    assert result["available"] is True
    assert result["global_average"] == pytest.approx(8.0)

    assert len(result["ambits"]) == 1
    assert result["ambits"][0]["letter"] == "A"
    assert result["ambits"][0]["average"] == pytest.approx(8.0)

def test_benchmark_counts_multiuser_company_only_once(
    db_session,
    benchmark_data,
):
    data = benchmark_data

    peers = [
        create_peer(db_session, data, score)
        for score in [6, 7, 8, 9, 10]
    ]

    company, previous_evaluation = peers[0]

    second_user = User(
        name="Second",
        lastname="Member",
        position="Collaborator",
        company_name=company.name,
        email=f"multiuser-{uuid4().hex}@test.local",
        phone="9999999999",
        password="test-password",
        role=UserRole.USER,
        active=True,
    )

    db_session.add(second_user)
    db_session.flush()

    db_session.add(
        CompanyMembership(
            user_id=second_user.id,
            company_id=company.id,
            role=CompanyRole.COLLABORATOR,
            status=CompanyMembershipStatus.ACTIVE,
        )
    )

    newer_evaluation = Evaluation(
        user_id=second_user.id,
        company_id=company.id,
        methodology_id=data["methodology"].id,
        status=EvaluationStatus.COMPLETED,
        global_score=10.0,
    )

    db_session.add(newer_evaluation)
    db_session.flush()

    result = get_results(db_session, data)

    assert result["available"] is True

    # The five companies contribute 10, 7, 8, 9 and 10.
    # The older score of 6 must not contribute.
    assert result["global_average"] == pytest.approx(8.8)


def test_benchmark_does_not_fallback_to_older_evaluation(
    db_session,
    benchmark_data,
):
    data = benchmark_data

    peers = [
        create_peer(db_session, data, score)
        for score in [6, 7, 8, 9, 10]
    ]

    company, previous_evaluation = peers[0]

    latest_evaluation = Evaluation(
        user_id=previous_evaluation.user_id,
        company_id=company.id,
        methodology_id=data["methodology"].id,
        status=EvaluationStatus.COMPLETED,
        global_score=None,
    )

    db_session.add(latest_evaluation)
    db_session.flush()

    result = get_results(db_session, data)

    # Only four companies have a valid latest global score.
    # The previous score must not be used as a fallback.
    assert result["available"] is False
    assert result["global_average"] is None
    assert result["ambits"] == []
