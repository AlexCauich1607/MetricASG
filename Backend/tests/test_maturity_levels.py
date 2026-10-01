import pytest
from fastapi import HTTPException

from app.models.maturity_level_model import MaturityLevel
from app.models.methodology_model import Methodology, MethodologyStatus
from app.services.evaluations_service import EvaluationService


def create_maturity_levels(db_session):
    methodology = Methodology(
        name="Test Maturity Levels",
        version="TEST-1.0.0",
        status=MethodologyStatus.PUBLISHED,
        is_active=False,
    )

    db_session.add(methodology)
    db_session.flush()

    levels = [
        MaturityLevel(
            name="Básico",
            value=6,
            description="",
            min_score=6,
            max_score=7.5,
            color="#a6074c",
            is_removable=False,
            methodology_id=methodology.id,
        ),
        MaturityLevel(
            name="Intermedio",
            value=8,
            description="",
            min_score=7.5,
            max_score=9.5,
            color="#13b46e",
            is_removable=False,
            methodology_id=methodology.id,
        ),
        MaturityLevel(
            name="Avanzado",
            value=10,
            description="",
            min_score=9.5,
            max_score=10,
            color="#0a4057",
            is_removable=False,
            methodology_id=methodology.id,
        ),
    ]

    db_session.add_all(levels)
    db_session.flush()

    return methodology


@pytest.mark.parametrize(
    ("score", "expected_level"),
    [
        (6.0, "Básico"),
        (7.5, "Intermedio"),
        (9.5, "Avanzado"),
        (10.0, "Avanzado"),
    ],
)
def test_maturity_level_boundaries(
    db_session,
    score,
    expected_level,
):
    methodology = create_maturity_levels(db_session)

    service = EvaluationService(db_session)

    maturity_level = service.get_maturity_level_for_score(
        score,
        methodology.id,
    )

    assert maturity_level.name == expected_level


@pytest.mark.parametrize(
    "score",
    [
        5.99,
        10.01,
    ],
)
def test_maturity_level_rejects_score_outside_ranges(
    db_session,
    score,
):
    methodology = create_maturity_levels(db_session)

    service = EvaluationService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.get_maturity_level_for_score(
            score,
            methodology.id,
        )

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == (
        f"No maturity level configured for score {score}"
    )


def test_maturity_level_rejects_unconfigured_methodology(
    db_session,
):
    methodology = Methodology(
        name="Test Without Maturity Levels",
        version="TEST-2.0.0",
        status=MethodologyStatus.PUBLISHED,
        is_active=False,
    )

    db_session.add(methodology)
    db_session.flush()

    service = EvaluationService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.get_maturity_level_for_score(
            8.0,
            methodology.id,
        )

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "Maturity levels are not configured"