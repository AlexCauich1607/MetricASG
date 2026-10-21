import uuid
from unittest.mock import patch
from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import OperationalError, IntegrityError

from app.main import app
from app.services.token_service import get_current_user
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

    answers = [
        IndicatorAnswer(
            indicator_id=indicator.id,
            maturity_level_id=maturity_levels[1].id,
            text=f"Test answer for indicator {indicator.id}",
        )
        for indicator in indicators
    ]

    db_session.add_all(answers)
    db_session.flush()

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

def test_evaluation_rejects_duplicate_indicator_responses(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    result = service.submit_evaluation(
        {"responses": build_responses(data)},
        data["user"].id,
    )

    evaluation_id = result["evaluation_id"]
    indicator = data["indicators"][0]
    answer = data["answers"][0]

    duplicate_response = EvaluationIndicatorResponse(
        evaluation_id=evaluation_id,
        indicator_id=indicator.id,
        indicator_answer_id=answer.id,
        maturity_level_id=answer.maturity_level_id,
        score=8,
    )

    db_session.add(duplicate_response)

    with pytest.raises(IntegrityError):
        db_session.flush()

    db_session.rollback()

def test_save_draft_creates_partial_evaluation(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    responses = build_responses(data)[:2]

    result = service.save_draft(
        {"responses": responses},
        data["user"].id,
    )

    evaluation = (
        db_session.query(Evaluation)
        .filter(Evaluation.id == result["evaluation_id"])
        .one()
    )

    saved_responses = (
        db_session.query(EvaluationIndicatorResponse)
        .filter(
            EvaluationIndicatorResponse.evaluation_id
            == evaluation.id
        )
        .order_by(EvaluationIndicatorResponse.indicator_id)
        .all()
    )

    ambit_scores = (
        db_session.query(EvaluationAmbitScore)
        .filter(EvaluationAmbitScore.evaluation_id == evaluation.id)
        .all()
    )

    assert result["status"] == EvaluationStatus.DRAFT.value
    assert evaluation.status == EvaluationStatus.DRAFT
    assert evaluation.user_id == data["user"].id
    assert evaluation.methodology_id == data["methodology"].id

    assert evaluation.global_score is None
    assert evaluation.global_maturity_level_id is None

    assert len(saved_responses) == 2

    for saved, submitted in zip(saved_responses, responses):
        assert saved.indicator_id == submitted["indicator_id"]
        assert saved.indicator_answer_id == submitted["indicator_answer_id"]

    assert ambit_scores == []

def test_save_draft_is_idempotent(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    payload = {
        "responses": build_responses(data)[:2],
    }

    first_result = service.save_draft(
        payload,
        data["user"].id,
    )

    second_result = service.save_draft(
        payload,
        data["user"].id,
    )

    assert (
        first_result["evaluation_id"]
        == second_result["evaluation_id"]
    )

    evaluations = (
        db_session.query(Evaluation)
        .filter(
            Evaluation.user_id == data["user"].id,
            Evaluation.methodology_id == data["methodology"].id,
            Evaluation.status == EvaluationStatus.DRAFT,
        )
        .all()
    )

    assert len(evaluations) == 1

    saved_responses = (
        db_session.query(EvaluationIndicatorResponse)
        .filter(
            EvaluationIndicatorResponse.evaluation_id
            == first_result["evaluation_id"]
        )
        .all()
    )

    assert len(saved_responses) == 2

    saved_answers = {
        response.indicator_id: response.indicator_answer_id
        for response in saved_responses
    }

    expected_answers = {
        response["indicator_id"]: response["indicator_answer_id"]
        for response in payload["responses"]
    }

    assert saved_answers == expected_answers

def test_save_draft_updates_existing_response(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    initial_responses = build_responses(data)[:2]

    first_result = service.save_draft(
        {"responses": initial_responses},
        data["user"].id,
    )

    indicator = data["indicators"][0]
    new_answer = IndicatorAnswer(
        indicator_id=indicator.id,
        maturity_level_id=data["maturity_levels"][2].id,
        text="Updated test answer",
    )

    db_session.add(new_answer)
    db_session.flush()

    updated_responses = [
        {
            "indicator_id": indicator.id,
            "indicator_answer_id": new_answer.id,
        },
        initial_responses[1],
    ]

    second_result = service.save_draft(
        {"responses": updated_responses},
        data["user"].id,
    )

    assert (
        first_result["evaluation_id"]
        == second_result["evaluation_id"]
    )

    saved_responses = (
        db_session.query(EvaluationIndicatorResponse)
        .filter(
            EvaluationIndicatorResponse.evaluation_id
            == first_result["evaluation_id"]
        )
        .all()
    )

    assert len(saved_responses) == 2

    saved_by_indicator = {
        response.indicator_id: response
        for response in saved_responses
    }

    updated = saved_by_indicator[indicator.id]

    assert updated.indicator_answer_id == new_answer.id
    assert updated.maturity_level_id == data["maturity_levels"][2].id
    assert updated.score == data["maturity_levels"][2].value

    unchanged = saved_by_indicator[initial_responses[1]["indicator_id"]]

    assert (
        unchanged.indicator_answer_id
        == initial_responses[1]["indicator_answer_id"]
    )

def test_save_draft_preserves_responses_on_validation_error(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    initial_responses = build_responses(data)[:2]

    result = service.save_draft(
        {"responses": initial_responses},
        data["user"].id,
    )

    evaluation_id = result["evaluation_id"]

    invalid_responses = [
        initial_responses[0],
        {
            "indicator_id": data["indicators"][1].id,
            "indicator_answer_id": 999999999,
        },
    ]

    with pytest.raises(HTTPException) as exc_info:
        service.save_draft(
            {"responses": invalid_responses},
            data["user"].id,
        )

    assert exc_info.value.status_code == 422

    db_session.expire_all()

    saved_responses = (
        db_session.query(EvaluationIndicatorResponse)
        .filter(
            EvaluationIndicatorResponse.evaluation_id
            == evaluation_id
        )
        .all()
    )

    saved_answers = {
        response.indicator_id: response.indicator_answer_id
        for response in saved_responses
    }

    expected_answers = {
        response["indicator_id"]: response["indicator_answer_id"]
        for response in initial_responses
    }

    assert saved_answers == expected_answers

def test_save_draft_preserves_response_ids(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    payload = {
        "responses": build_responses(data)[:2],
    }

    result = service.save_draft(
        payload,
        data["user"].id,
    )

    evaluation_id = result["evaluation_id"]

    initial_responses = (
        db_session.query(EvaluationIndicatorResponse)
        .filter(
            EvaluationIndicatorResponse.evaluation_id
            == evaluation_id
        )
        .all()
    )

    initial_ids = {
        response.indicator_id: response.id
        for response in initial_responses
    }

    service.save_draft(
        payload,
        data["user"].id,
    )

    updated_responses = (
        db_session.query(EvaluationIndicatorResponse)
        .filter(
            EvaluationIndicatorResponse.evaluation_id
            == evaluation_id
        )
        .all()
    )

    updated_ids = {
        response.indicator_id: response.id
        for response in updated_responses
    }

    assert updated_ids == initial_ids

def test_save_draft_removes_unselected_responses(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    initial_responses = build_responses(data)

    first_result = service.save_draft(
        {"responses": initial_responses},
        data["user"].id,
    )

    evaluation_id = first_result["evaluation_id"]

    remaining_responses = initial_responses[:2]

    second_result = service.save_draft(
        {"responses": remaining_responses},
        data["user"].id,
    )

    assert second_result["evaluation_id"] == evaluation_id

    saved_responses = (
        db_session.query(EvaluationIndicatorResponse)
        .filter(
            EvaluationIndicatorResponse.evaluation_id
            == evaluation_id
        )
        .all()
    )

    assert len(saved_responses) == 2

    saved_answers = {
        response.indicator_id: response.indicator_answer_id
        for response in saved_responses
    }

    expected_answers = {
        response["indicator_id"]: response["indicator_answer_id"]
        for response in remaining_responses
    }

    assert saved_answers == expected_answers

    removed_indicator_id = initial_responses[2]["indicator_id"]

    assert removed_indicator_id not in saved_answers

def test_evaluation_rejects_duplicate_drafts(db_session):
    data = create_evaluation_data(db_session)

    first_draft = Evaluation(
        user_id=data["user"].id,
        methodology_id=data["methodology"].id,
        date=date.today(),
        status=EvaluationStatus.DRAFT,
    )

    db_session.add(first_draft)
    db_session.flush()

    second_draft = Evaluation(
        user_id=data["user"].id,
        methodology_id=data["methodology"].id,
        date=date.today(),
        status=EvaluationStatus.DRAFT,
    )

    db_session.add(second_draft)

    with pytest.raises(IntegrityError):
        db_session.flush()

    db_session.rollback()

def test_save_draft_rolls_back_on_database_error(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    payload = {
        "responses": build_responses(data)[:2],
    }

    database_error = OperationalError(
        "COMMIT",
        {},
        Exception("Simulated database error"),
    )

    with patch.object(
        db_session,
        "commit",
        side_effect=database_error,
    ), patch.object(
        db_session,
        "rollback",
        wraps=db_session.rollback,
    ) as mock_rollback:

        with pytest.raises(OperationalError):
            service.save_draft(
                payload,
                data["user"].id,
            )

        mock_rollback.assert_called_once()

def test_save_draft_returns_409_on_duplicate_draft(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    payload = {
        "responses": build_responses(data)[:2],
    }

    class SimulatedDatabaseError(Exception):
        def __init__(self):
            self.diag = type(
                "Diagnostic",
                (),
                {
                    "constraint_name":
                    "uq_evaluations_user_methodology_draft"
                },
            )()

    database_error = IntegrityError(
        "INSERT INTO evaluations",
        {},
        SimulatedDatabaseError(),
    )

    with patch.object(
        db_session,
        "flush",
        side_effect=database_error,
    ), patch.object(
        db_session,
        "rollback",
        wraps=db_session.rollback,
    ) as mock_rollback:

        with pytest.raises(HTTPException) as exc_info:
            service.save_draft(
                payload,
                data["user"].id,
            )

        assert exc_info.value.status_code == 409

        mock_rollback.assert_called_once()

def test_evaluation_row_lock_prevents_concurrent_access():
    from sqlalchemy import text
    from sqlalchemy.exc import OperationalError
    from tests.conftest import engine

    user_id = None

    try:
        # Prepare committed test data
        with engine.begin() as connection:
            methodology_id = connection.execute(
                text(
                    """
                    SELECT id
                    FROM methodologies
                    ORDER BY id
                    LIMIT 1
                    """
                )
            ).scalar_one()

            user_id = connection.execute(
                text(
                    """
                    INSERT INTO users (
                        company_name,
                        email,
                        password,
                        role
                    )
                    VALUES (
                        'Concurrency Test Company',
                        :email,
                        'test-password',
                        'USER'
                    )
                    RETURNING id
                    """
                ),
                {
                    "email": (
                        f"concurrency-test-{uuid.uuid4().hex}@example.com"
                    )
                },
            ).scalar_one()

            evaluation_id = connection.execute(
                text(
                    """
                    INSERT INTO evaluations (
                        user_id,
                        methodology_id,
                        status
                    )
                    VALUES (
                        :user_id,
                        :methodology_id,
                        'DRAFT'
                    )
                    RETURNING id
                    """
                ),
                {
                    "user_id": user_id,
                    "methodology_id": methodology_id,
                },
            ).scalar_one()

        # Connection A acquires the row lock
        with engine.connect() as connection_a:
            with connection_a.begin():
                connection_a.execute(
                    text(
                        """
                        SELECT id
                        FROM evaluations
                        WHERE id = :evaluation_id
                        FOR UPDATE
                        """
                    ),
                    {"evaluation_id": evaluation_id},
                ).scalar_one()

                # Connection B attempts the same lock
                with engine.connect() as connection_b:
                    with connection_b.begin():
                        connection_b.execute(
                            text("SET LOCAL lock_timeout = '500ms'")
                        )

                        with pytest.raises(OperationalError) as exc_info:
                            connection_b.execute(
                                text(
                                    """
                                    SELECT id
                                    FROM evaluations
                                    WHERE id = :evaluation_id
                                    FOR UPDATE
                                    """
                                ),
                                {"evaluation_id": evaluation_id},
                            )

                        assert (
                            getattr(exc_info.value.orig, "pgcode", None)
                            == "55P03"
                        )

    finally:
        if user_id is not None:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        """
                        DELETE FROM users
                        WHERE id = :user_id
                        """
                    ),
                    {"user_id": user_id},
                )

def test_get_draft_returns_saved_responses(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    responses = build_responses(data)[:2]

    saved_draft = service.save_draft(
        {"responses": responses},
        data["user"].id,
    )

    result = service.get_draft(data["user"].id)

    assert result is not None
    assert result["evaluation_id"] == saved_draft["evaluation_id"]
    assert result["status"] == EvaluationStatus.DRAFT.value
    assert result["responses"] == responses

def test_get_draft_returns_none_when_no_draft_exists(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    result = service.get_draft(data["user"].id)

    assert result is None

def test_get_draft_does_not_return_another_users_draft(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    responses = build_responses(data)[:2]

    service.save_draft(
        {"responses": responses},
        data["user"].id,
    )

    other_user = User(
        name="Other",
        lastname="User",
        position="Tester",
        company_name="Other Test Company",
        email="other-evaluation-user@test.local",
        phone="9999999998",
        password="test-password",
        role=UserRole.USER,
        active=True,
    )

    db_session.add(other_user)
    db_session.flush()

    result = service.get_draft(other_user.id)

    assert result is None

def test_get_draft_does_not_return_another_methodology_draft(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    responses = build_responses(data)[:2]

    service.save_draft(
        {"responses": responses},
        data["user"].id,
    )

    data["methodology"].is_active = False

    new_methodology = Methodology(
        name="New Evaluation Test Methodology",
        version="TEST-EVALUATION-2",
        status=MethodologyStatus.PUBLISHED,
        is_active=True,
    )

    db_session.add(new_methodology)
    db_session.flush()

    result = service.get_draft(data["user"].id)

    assert result is None

def test_get_draft_requires_authentication(client):
    response = client.get("/api/evaluations/draft")

    assert response.status_code == 401

def test_get_draft_endpoint_returns_authenticated_users_draft(
    client,
    db_session,
):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    responses = build_responses(data)[:2]

    saved_draft = service.save_draft(
        {"responses": responses},
        data["user"].id,
    )

    app.dependency_overrides[get_current_user] = lambda: data["user"]

    try:
        response = client.get("/api/evaluations/draft")

        assert response.status_code == 200
        assert response.json() == {
            "evaluation_id": saved_draft["evaluation_id"],
            "status": EvaluationStatus.DRAFT.value,
            "responses": responses,
        }
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_submit_evaluation_reuses_existing_draft(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    responses = build_responses(data)

    saved_draft = service.save_draft(
        {"responses": responses[:2]},
        data["user"].id,
    )

    draft_id = saved_draft["evaluation_id"]

    result = service.submit_evaluation(
        {"responses": responses},
        data["user"].id,
    )

    evaluation = db_session.get(Evaluation, draft_id)

    assert evaluation is not None
    assert result["evaluation_id"] == draft_id
    assert evaluation.status == EvaluationStatus.COMPLETED

    assert db_session.query(Evaluation).filter(
        Evaluation.user_id == data["user"].id,
        Evaluation.methodology_id == data["methodology"].id,
    ).count() == 1

    assert service.get_draft(data["user"].id) is None

def test_submit_evaluation_replaces_draft_responses(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    responses = build_responses(data)

    saved_draft = service.save_draft(
        {"responses": responses[:2]},
        data["user"].id,
    )

    draft_id = saved_draft["evaluation_id"]

    service.submit_evaluation(
        {"responses": responses},
        data["user"].id,
    )

    saved_responses = (
        db_session.query(EvaluationIndicatorResponse)
        .filter(
            EvaluationIndicatorResponse.evaluation_id == draft_id
        )
        .all()
    )

    assert len(saved_responses) == len(responses)

    saved_answers = {
        response.indicator_id: response.indicator_answer_id
        for response in saved_responses
    }

    expected_answers = {
        response["indicator_id"]: response["indicator_answer_id"]
        for response in responses
    }

    assert saved_answers == expected_answers

def test_submit_evaluation_without_existing_draft(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    responses = build_responses(data)

    result = service.submit_evaluation(
        {"responses": responses},
        data["user"].id,
    )

    evaluation = db_session.get(
        Evaluation,
        result["evaluation_id"],
    )

    assert evaluation is not None
    assert evaluation.status == EvaluationStatus.COMPLETED

    assert evaluation.user_id == data["user"].id
    assert evaluation.methodology_id == data["methodology"].id

    saved_responses = (
        db_session.query(EvaluationIndicatorResponse)
        .filter(
            EvaluationIndicatorResponse.evaluation_id == evaluation.id
        )
        .all()
    )

    assert len(saved_responses) == len(responses)

    expected_answers = {
        response["indicator_id"]: response["indicator_answer_id"]
        for response in responses
    }

    actual_answers = {
        response.indicator_id: response.indicator_answer_id
        for response in saved_responses
    }

    assert actual_answers == expected_answers
    assert service.get_draft(data["user"].id) is None


def test_submit_evaluation_rolls_back_when_calculation_fails(
    db_session,
):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    responses = build_responses(data)

    saved_draft = service.save_draft(
        {"responses": responses[:2]},
        data["user"].id,
    )

    draft_id = saved_draft["evaluation_id"]

    with patch.object(
        service,
        "calculate_global_score",
        side_effect=RuntimeError("Simulated calculation error"),
    ):
        with patch.object(
            db_session,
            "rollback",
            wraps=db_session.rollback,
        ) as rollback_spy:
            with pytest.raises(
                RuntimeError,
                match="Simulated calculation error",
            ):
                service.submit_evaluation(
                    {"responses": responses},
                    data["user"].id,
                )

            rollback_spy.assert_called_once()

    evaluation = db_session.get(Evaluation, draft_id)

    assert evaluation is not None
    assert evaluation.status == EvaluationStatus.DRAFT

    saved_responses = (
        db_session.query(EvaluationIndicatorResponse)
        .filter(
            EvaluationIndicatorResponse.evaluation_id == draft_id
        )
        .all()
    )

    expected_answers = {
        response["indicator_id"]: response["indicator_answer_id"]
        for response in responses[:2]
    }

    actual_answers = {
        response.indicator_id: response.indicator_answer_id
        for response in saved_responses
    }

    assert actual_answers == expected_answers

def test_submit_evaluation_calculates_scores_from_draft(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    responses = build_responses(data)

    saved_draft = service.save_draft(
        {"responses": responses[:2]},
        data["user"].id,
    )

    result = service.submit_evaluation(
        {"responses": responses},
        data["user"].id,
    )

    evaluation = db_session.get(
        Evaluation,
        saved_draft["evaluation_id"],
    )

    assert evaluation is not None
    assert result["evaluation_id"] == evaluation.id
    assert evaluation.status == EvaluationStatus.COMPLETED

    assert evaluation.global_score is not None
    assert evaluation.global_maturity_level_id is not None

    ambit_scores = (
        db_session.query(EvaluationAmbitScore)
        .filter(
            EvaluationAmbitScore.evaluation_id == evaluation.id
        )
        .all()
    )

    assert len(ambit_scores) == len(data["ambits"])

    for ambit_score in ambit_scores:
        assert ambit_score.score is not None
        assert ambit_score.maturity_level_id is not None