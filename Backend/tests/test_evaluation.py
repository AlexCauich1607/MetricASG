import pytest

from fastapi import HTTPException

from app.core.roles import UserRole
from app.models.ambit_model import Ambit
from app.models.evaluation_ambit_score_model import EvaluationAmbitScore
from app.models.evaluation_indicator_response_model import (
    EvaluationIndicatorResponse,
)
from app.models.evaluation_model import Evaluation, EvaluationStatus
from app.models.indicator_answer_model import IndicatorAnswer
from app.models.indicator_model import Indicator
from app.models.maturity_level_model import MaturityLevel
from app.models.methodology_model import (
    Methodology,
    MethodologyStatus,
)
from app.models.user_model import User
from app.services.evaluations_service import EvaluationService


def create_evaluation_data(db_session):
    active_methodology = (
        db_session.query(Methodology)
        .filter(Methodology.is_active.is_(True))
        .first()
    )

    if active_methodology:
        active_methodology.is_active = False
        db_session.flush()

    methodology = Methodology(
        name="Evaluation Test Methodology",
        version="TEST-EVALUATION-1",
        status=MethodologyStatus.PUBLISHED,
        is_active=True,
    )

    db_session.add(methodology)
    db_session.flush()

    ambits = [
        Ambit(
            name="Ambiental",
            description="",
            letter="A",
            color="#37AB48",
            is_removable=False,
            methodology_id=methodology.id,
        ),
        Ambit(
            name="Social",
            description="",
            letter="S",
            color="#1565C0",
            is_removable=False,
            methodology_id=methodology.id,
        ),
        Ambit(
            name="Gobernanza",
            description="",
            letter="G",
            color="#4527A0",
            is_removable=False,
            methodology_id=methodology.id,
        ),
    ]

    db_session.add_all(ambits)
    db_session.flush()

    maturity_levels = [
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

    db_session.add_all(maturity_levels)
    db_session.flush()

    indicators = [
        Indicator(
            ambit_id=ambits[0].id,
            question="Evaluation test indicator A",
        ),
        Indicator(
            ambit_id=ambits[1].id,
            question="Evaluation test indicator S",
        ),
        Indicator(
            ambit_id=ambits[2].id,
            question="Evaluation test indicator G",
        ),
    ]

    db_session.add_all(indicators)
    db_session.flush()

    answers = (
        db_session.query(IndicatorAnswer)
        .filter(
            IndicatorAnswer.indicator_id.in_(
                [indicator.id for indicator in indicators]
            ),
            IndicatorAnswer.maturity_level_id
            == maturity_levels[1].id,
        )
        .order_by(IndicatorAnswer.indicator_id)
        .all()
    )

    user = User(
        name="Evaluation",
        lastname="Test",
        position="Tester",
        company_name="Evaluation Test Company",
        email="evaluation-test@test.local",
        phone="9999999999",
        password="test-password",
        role=UserRole.USER,
        active=True,
    )

    db_session.add(user)
    db_session.flush()

    return {
        "methodology": methodology,
        "ambits": ambits,
        "maturity_levels": maturity_levels,
        "indicators": indicators,
        "answers": answers,
        "user": user,
    }


def build_responses(data):
    return [
        {
            "indicator_id": indicator.id,
            "indicator_answer_id": answer.id,
        }
        for indicator, answer in zip(
            data["indicators"],
            data["answers"],
        )
    ]


def test_submit_evaluation_calculates_scores(db_session):
    data = create_evaluation_data(db_session)

    service = EvaluationService(db_session)

    result = service.submit_evaluation(
        {
            "responses": build_responses(data),
        },
        data["user"].id,
    )

    evaluation = (
        db_session.query(Evaluation)
        .filter(Evaluation.id == result["evaluation_id"])
        .one()
    )

    ambit_scores = (
        db_session.query(EvaluationAmbitScore)
        .filter(
            EvaluationAmbitScore.evaluation_id
            == evaluation.id
        )
        .all()
    )

    indicator_responses = (
        db_session.query(EvaluationIndicatorResponse)
        .filter(
            EvaluationIndicatorResponse.evaluation_id
            == evaluation.id
        )
        .all()
    )

    assert result["global_score"] == 8

    assert evaluation.status == EvaluationStatus.COMPLETED
    assert evaluation.global_score == 8
    assert evaluation.methodology_id == data["methodology"].id

    assert len(ambit_scores) == 3
    assert all(score.score == 8 for score in ambit_scores)

    assert len(indicator_responses) == 3
    assert all(response.score == 8 for response in indicator_responses)


def test_submit_evaluation_rejects_incomplete_responses(
    db_session,
):
    data = create_evaluation_data(db_session)

    service = EvaluationService(db_session)

    responses = build_responses(data)[:-1]

    with pytest.raises(HTTPException) as exc_info:
        service.submit_evaluation(
            {"responses": responses},
            data["user"].id,
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["message"] == (
        "Evaluation is incomplete"
    )
    assert data["indicators"][-1].id in (
        exc_info.value.detail["missing_indicator_ids"]
    )


def test_submit_evaluation_rejects_duplicate_indicators(
    db_session,
):
    data = create_evaluation_data(db_session)

    service = EvaluationService(db_session)

    responses = build_responses(data)
    responses[1]["indicator_id"] = responses[0]["indicator_id"]

    with pytest.raises(HTTPException) as exc_info:
        service.submit_evaluation(
            {"responses": responses},
            data["user"].id,
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["message"] == (
        "Duplicate indicators are not allowed"
    )
    assert (
        data["indicators"][0].id
        in exc_info.value.detail["duplicate_indicator_ids"]
    )


def test_submit_evaluation_rejects_answer_from_other_indicator(
    db_session,
):
    data = create_evaluation_data(db_session)

    service = EvaluationService(db_session)

    responses = build_responses(data)

    responses[0]["indicator_answer_id"] = (
        data["answers"][1].id
    )

    with pytest.raises(HTTPException) as exc_info:
        service.submit_evaluation(
            {"responses": responses},
            data["user"].id,
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["message"] == (
        "Indicator answer does not belong to indicator"
    )
    assert (
        exc_info.value.detail["indicator_id"]
        == data["indicators"][0].id
    )
    assert (
        exc_info.value.detail["indicator_answer_id"]
        == data["answers"][1].id
    )