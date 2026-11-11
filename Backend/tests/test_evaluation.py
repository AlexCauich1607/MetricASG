import uuid
from uuid import uuid4
from unittest.mock import patch
from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import OperationalError, IntegrityError

from app.main import app
from app.services.token_service import get_current_user
from app.core.roles import UserRole, CompanyRole
from app.models.ambit_model import Ambit
from app.models.evaluation_ambit_score_model import EvaluationAmbitScore
from app.models.evaluation_indicator_response_model import (
    EvaluationIndicatorResponse,
)

from app.services.evidence_storage_service import EvidenceStorageService
from tests.test_evidence_storage_service import create_valid_pdf

from app.models.evaluation_evidence_model import (
    EvaluationEvidence,
    EvidenceType,
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
from app.models.company_model import Company
from app.models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)

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

    company = Company(
        name=user.company_name,
        sector_id=user.company_sector_id,
        size_id=user.company_size_id,
        active=True,
    )

    db_session.add(company)
    db_session.flush()

    membership = CompanyMembership(
        user_id=user.id,
        company_id=company.id,
        role=CompanyRole.ASG_MANAGER,
        status=CompanyMembershipStatus.ACTIVE,
    )

    db_session.add(membership)
    db_session.flush()

    return {
        "methodology": methodology,
        "ambits": ambits,
        "maturity_levels": maturity_levels,
        "indicators": indicators,
        "answers": answers,
        "user": user,
        "company": company,
        "membership": membership,
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
        company_id=data["company"].id,
        methodology_id=data["methodology"].id,
        date=date.today(),
        status=EvaluationStatus.DRAFT,
    )

    db_session.add(first_draft)
    db_session.flush()

    second_draft = Evaluation(
        user_id=data["user"].id,
        company_id=data["company"].id,
        methodology_id=data["methodology"].id,
        date=date.today(),
        status=EvaluationStatus.DRAFT,
    )

    db_session.add(second_draft)

    with pytest.raises(IntegrityError):
        db_session.flush()

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
    company_id = None

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

            company_id = connection.execute(
                text(
                    """
                    INSERT INTO companies (name)
                    VALUES ('Concurrency Test Company')
                    RETURNING id
                    """
                )
            ).scalar_one()

            connection.execute(
                text(
                    """
                    INSERT INTO company_memberships (
                        user_id,
                        company_id,
                        status
                    )
                    VALUES (
                        :user_id,
                        :company_id,
                        'ACTIVE'
                    )
                    """
                ),
                {
                    "user_id": user_id,
                    "company_id": company_id,
                },
            )

            evaluation_id = connection.execute(
                text(
                    """
                    INSERT INTO evaluations (
                        user_id,
                        company_id,
                        methodology_id,
                        status
                    )
                    VALUES (
                        :user_id,
                        :company_id,
                        :methodology_id,
                        'DRAFT'
                    )
                    RETURNING id
                    """
                ),
                {
                    "user_id": user_id,
                    "company_id": company_id,
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
        if user_id is not None or company_id is not None:
            with engine.begin() as connection:
                if user_id is not None:
                    connection.execute(
                        text(
                            """
                            DELETE FROM company_memberships
                            WHERE user_id = :user_id
                            """
                        ),
                        {"user_id": user_id},
                    )

                    connection.execute(
                        text(
                            """
                            DELETE FROM users
                            WHERE id = :user_id
                            """
                        ),
                        {"user_id": user_id},
                    )

                if company_id is not None:
                    connection.execute(
                        text(
                            """
                            DELETE FROM companies
                            WHERE id = :company_id
                            """
                        ),
                        {"company_id": company_id},
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

    other_company = Company(
        name=other_user.company_name,
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



def test_save_draft_removes_evidences_of_unselected_indicators(
    db_session,
):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    initial_responses = build_responses(data)

    result = service.save_draft(
        {"responses": initial_responses},
        data["user"].id,
    )

    evaluation_id = result["evaluation_id"]

    preserved_indicator_id = initial_responses[0]["indicator_id"]
    removed_indicator_id = initial_responses[2]["indicator_id"]

    preserved_evidence = EvaluationEvidence(
        evaluation_id=evaluation_id,
        indicator_id=preserved_indicator_id,
        user_id=data["user"].id,
        type=EvidenceType.COMMENT,
        content="Evidence to preserve",
    )

    removed_evidences = [
        EvaluationEvidence(
            evaluation_id=evaluation_id,
            indicator_id=removed_indicator_id,
            user_id=data["user"].id,
            type=EvidenceType.COMMENT,
            content="Comment to remove",
        ),
        EvaluationEvidence(
            evaluation_id=evaluation_id,
            indicator_id=removed_indicator_id,
            user_id=data["user"].id,
            type=EvidenceType.URL,
            content="https://example.com/remove",
        ),
    ]

    db_session.add_all(
        [preserved_evidence, *removed_evidences]
    )
    db_session.commit()

    service.save_draft(
        {"responses": initial_responses[:2]},
        data["user"].id,
    )

    saved_evidences = (
        db_session.query(EvaluationEvidence)
        .filter(
            EvaluationEvidence.evaluation_id == evaluation_id
        )
        .all()
    )

    assert len(saved_evidences) == 1
    assert saved_evidences[0].indicator_id == preserved_indicator_id
    assert saved_evidences[0].content == "Evidence to preserve"


def test_submit_evaluation_preserves_draft_evidences(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    responses = build_responses(data)

    saved_draft = service.save_draft(
        {"responses": responses[:2]},
        data["user"].id,
    )

    evaluation_id = saved_draft["evaluation_id"]
    indicator_id = responses[0]["indicator_id"]

    evidence = EvaluationEvidence(
        evaluation_id=evaluation_id,
        indicator_id=indicator_id,
        user_id=data["user"].id,
        type=EvidenceType.COMMENT,
        content="Evidence preserved after submission",
    )

    db_session.add(evidence)
    db_session.commit()

    evidence_id = evidence.id

    result = service.submit_evaluation(
        {"responses": responses},
        data["user"].id,
    )

    assert result["evaluation_id"] == evaluation_id
    assert result["status"] == "COMPLETED"

    preserved_evidence = db_session.get(
        EvaluationEvidence,
        evidence_id,
    )

    assert preserved_evidence is not None
    assert preserved_evidence.evaluation_id == evaluation_id
    assert preserved_evidence.indicator_id == indicator_id
    assert preserved_evidence.content == (
        "Evidence preserved after submission"
    )

    saved_responses = (
        db_session.query(EvaluationIndicatorResponse)
        .filter(
            EvaluationIndicatorResponse.evaluation_id
            == evaluation_id
        )
        .all()
    )

    assert len(saved_responses) == len(responses)

    assert indicator_id in {
        response.indicator_id
        for response in saved_responses
    }


def test_save_draft_removes_file_evidence_storage(
    db_session,
    tmp_path,
):
    data = create_evaluation_data(db_session)

    service = EvaluationService(db_session)
    user_id = data["user"].id

    responses = build_responses(data)[:2]

    # Crear el borrador con dos respuestas.
    result = service.save_draft(
        {"responses": responses},
        user_id,
    )

    evaluation_id = result["evaluation_id"]
    removed_indicator_id = responses[1]["indicator_id"]

    storage = EvidenceStorageService(
        storage_path=tmp_path,
    )

    content = create_valid_pdf()

    storage_key = storage.save_file(
        "evidencia.pdf",
        content,
        "application/pdf",
    )

    file_path = storage.get_file(storage_key)

    # Asociar el archivo con el indicador que retiraremos.
    evidence = EvaluationEvidence(
        evaluation_id=evaluation_id,
        indicator_id=removed_indicator_id,
        user_id=user_id,
        type=EvidenceType.FILE,
        content=None,
        storage_key=storage_key,
        original_filename="evidencia.pdf",
        mime_type="application/pdf",
        file_size=len(content),
    )

    db_session.add(evidence)
    db_session.commit()

    evidence_id = evidence.id

    assert file_path.exists()

    # Actualizar el borrador conservando solo la primera respuesta.
    service.save_draft(
        {"responses": responses[:1]},
        user_id,
        storage=storage,
    )

    # La respuesta retirada debe desaparecer.
    removed_response = (
        db_session.query(EvaluationIndicatorResponse)
        .filter(
            EvaluationIndicatorResponse.evaluation_id == evaluation_id,
            EvaluationIndicatorResponse.indicator_id == removed_indicator_id,
        )
        .first()
    )

    assert removed_response is None

    # También debe desaparecer el registro de evidencia.
    db_session.expire_all()

    assert db_session.get(
        EvaluationEvidence,
        evidence_id,
    ) is None

    # Finalmente, comprobar la eliminación física.
    assert not file_path.exists()

    # La respuesta que conservamos debe seguir disponible.
    preserved_response = (
        db_session.query(EvaluationIndicatorResponse)
        .filter(
            EvaluationIndicatorResponse.evaluation_id == evaluation_id,
            EvaluationIndicatorResponse.indicator_id
            == responses[0]["indicator_id"],
        )
        .first()
    )

    assert preserved_response is not None


def test_save_draft_preserves_file_evidence_on_commit_failure(
    db_session,
    tmp_path,
):
    data = create_evaluation_data(db_session)

    service = EvaluationService(db_session)
    user_id = data["user"].id
    responses = build_responses(data)[:2]

    result = service.save_draft(
        {"responses": responses},
        user_id,
    )

    evaluation_id = result["evaluation_id"]
    removed_indicator_id = responses[1]["indicator_id"]

    storage = EvidenceStorageService(
        storage_path=tmp_path,
    )

    content = create_valid_pdf()

    storage_key = storage.save_file(
        "evidencia.pdf",
        content,
        "application/pdf",
    )

    file_path = storage.get_file(storage_key)

    evidence = EvaluationEvidence(
        evaluation_id=evaluation_id,
        indicator_id=removed_indicator_id,
        user_id=user_id,
        type=EvidenceType.FILE,
        content=None,
        storage_key=storage_key,
        original_filename="evidencia.pdf",
        mime_type="application/pdf",
        file_size=len(content),
    )

    db_session.add(evidence)
    db_session.commit()

    evidence_id = evidence.id

    # Simulamos un error antes de confirmar los cambios.
    with patch.object(
        db_session,
        "commit",
        side_effect=OperationalError(
            "COMMIT",
            {},
            Exception("Simulated database failure"),
        ),
    ):
        with pytest.raises(OperationalError):
            service.save_draft(
                {"responses": responses[:1]},
                user_id,
                storage=storage,
            )

    db_session.expire_all()

    # La respuesta debe conservarse.
    preserved_response = (
        db_session.query(EvaluationIndicatorResponse)
        .filter(
            EvaluationIndicatorResponse.evaluation_id == evaluation_id,
            EvaluationIndicatorResponse.indicator_id == removed_indicator_id,
        )
        .first()
    )

    assert preserved_response is not None

    # El registro de evidencia debe conservarse.
    preserved_evidence = db_session.get(
        EvaluationEvidence,
        evidence_id,
    )

    assert preserved_evidence is not None
    assert preserved_evidence.storage_key == storage_key

    # El archivo físico también debe conservarse.
    assert file_path.exists()
    assert file_path.read_bytes() == content

def test_get_results_by_id_returns_completed_evaluation(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    submitted = service.submit_evaluation(
        {"responses": build_responses(data)},
        data["user"].id,
    )

    result = service.get_results_by_id(
        submitted["evaluation_id"],
        data["user"].id,
    )

    assert result["evaluation_id"] == submitted["evaluation_id"]
    assert result["global_score"] == 8
    assert result["global_maturity_level"] == "Intermedio"

    assert len(result["ambits"]) == 3
    assert all(ambit["score"] == 8 for ambit in result["ambits"])

    for ambit in result["ambits"]:
        assert {
            "ambit_id",
            "ambit_name",
            "score",
            "letter",
            "color",
            "maturity_level",
            "maturity_color",
            "feedback",
        }.issubset(ambit.keys())


def test_get_results_by_id_rejects_nonexistent_evaluation(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.get_results_by_id(
            999999,
            data["user"].id,
        )

    assert exc_info.value.status_code == 404


def test_get_results_by_id_rejects_other_user(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    submitted = service.submit_evaluation(
        {"responses": build_responses(data)},
        data["user"].id,
    )

    other_user = User(
        name="Other",
        lastname="User",
        position="Tester",
        company_name="Other Company",
        email="other-results-user@test.local",
        phone="9999999998",
        password="test-password",
        role=UserRole.USER,
        active=True,
    )

    db_session.add(other_user)
    db_session.flush()

    with pytest.raises(HTTPException) as exc_info:
        service.get_results_by_id(
            submitted["evaluation_id"],
            other_user.id,
        )

    assert exc_info.value.status_code == 404


def test_get_results_by_id_rejects_draft(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    draft = service.save_draft(
        {"responses": build_responses(data)[:1]},
        data["user"].id,
    )

    with pytest.raises(HTTPException) as exc_info:
        service.get_results_by_id(
            draft["evaluation_id"],
            data["user"].id,
        )

    assert exc_info.value.status_code == 404

def test_results_by_id_endpoint_requires_authentication(client):
    response = client.get(
        "/api/evaluations/1/results",
    )

    assert response.status_code == 401


def test_results_by_id_endpoint_returns_completed_evaluation(
    client,
    db_session,
):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    submitted = service.submit_evaluation(
        {"responses": build_responses(data)},
        data["user"].id,
    )

    app.dependency_overrides[get_current_user] = (
        lambda: data["user"]
    )

    try:
        response = client.get(
            f"/api/evaluations/{submitted['evaluation_id']}/results"
        )

        assert response.status_code == 200

        result = response.json()

        assert result["evaluation_id"] == submitted["evaluation_id"]
        assert result["global_score"] == 8
        assert result["global_maturity_level"] == "Intermedio"
        assert len(result["ambits"]) == 3
        assert all(
            ambit["score"] == 8
            for ambit in result["ambits"]
        )

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_results_by_id_endpoint_rejects_other_user(
    client,
    db_session,
):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    submitted = service.submit_evaluation(
        {"responses": build_responses(data)},
        data["user"].id,
    )

    other_user = User(
        name="Other",
        lastname="User",
        position="Tester",
        company_name="Other Company",
        email="other-results-endpoint@test.local",
        phone="9999999998",
        password="test-password",
        role=UserRole.USER,
        active=True,
    )

    db_session.add(other_user)
    db_session.flush()

    app.dependency_overrides[get_current_user] = (
        lambda: other_user
    )

    try:
        response = client.get(
            f"/api/evaluations/{submitted['evaluation_id']}/results"
        )

        assert response.status_code == 404

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_results_by_id_endpoint_rejects_draft(
    client,
    db_session,
):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    draft = service.save_draft(
        {"responses": build_responses(data)[:1]},
        data["user"].id,
    )

    app.dependency_overrides[get_current_user] = (
        lambda: data["user"]
    )

    try:
        response = client.get(
            f"/api/evaluations/{draft['evaluation_id']}/results"
        )

        assert response.status_code == 404

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_results_by_id_endpoint_rejects_nonexistent_evaluation(
    client,
    db_session,
):
    data = create_evaluation_data(db_session)

    app.dependency_overrides[get_current_user] = (
        lambda: data["user"]
    )

    try:
        response = client.get(
            "/api/evaluations/999999/results"
        )

        assert response.status_code == 404

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_get_results_by_id_rejects_inactive_company_membership(
    db_session,
):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    submitted = service.submit_evaluation(
        {"responses": build_responses(data)},
        data["user"].id,
    )

    membership = (
        db_session.query(CompanyMembership)
        .filter(
            CompanyMembership.user_id == data["user"].id,
            CompanyMembership.company_id == data["company"].id,
        )
        .one()
    )

    membership.status = CompanyMembershipStatus.INACTIVE
    db_session.flush()

    with pytest.raises(HTTPException) as exc_info:
        service.get_results_by_id(
            submitted["evaluation_id"],
            data["user"].id,
        )

    assert exc_info.value.status_code == 404

    # La evaluación histórica debe conservarse.
    saved_evaluation = db_session.get(
        Evaluation,
        submitted["evaluation_id"],
    )

    assert saved_evaluation is not None


def test_get_results_by_id_rejects_inactive_company(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    submitted = service.submit_evaluation(
        {"responses": build_responses(data)},
        data["user"].id,
    )

    company = data["company"]
    company.active = False
    db_session.flush()

    with pytest.raises(HTTPException) as exc_info:
        service.get_results_by_id(
            submitted["evaluation_id"],
            data["user"].id,
        )

    assert exc_info.value.status_code == 404

    db_session.expire_all()

    saved_evaluation = db_session.get(
        Evaluation,
        submitted["evaluation_id"],
    )

    assert saved_evaluation is not None
    assert saved_evaluation.company_id == company.id


def test_get_latest_results_rejects_inactive_company_membership(
    db_session,
):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    submitted = service.submit_evaluation(
        {"responses": build_responses(data)},
        data["user"].id,
    )

    membership = (
        db_session.query(CompanyMembership)
        .filter(
            CompanyMembership.user_id == data["user"].id,
            CompanyMembership.company_id == data["company"].id,
        )
        .one()
    )

    membership.status = CompanyMembershipStatus.INACTIVE
    db_session.flush()

    with pytest.raises(HTTPException) as exc_info:
        service.get_latest_results(
            user_id=data["user"].id,
            company_id=data["company"].id,
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == (
        "User does not have an active membership in this company"
    )

    saved_evaluation = db_session.get(
        Evaluation,
        submitted["evaluation_id"],
    )

    assert saved_evaluation is not None
    assert saved_evaluation.company_id == data["company"].id


def test_get_latest_results_requires_company_selection_for_multiple_memberships(
    db_session,
):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    submitted = service.submit_evaluation(
        {"responses": build_responses(data)},
        data["user"].id,
    )

    other_company = Company(
        name="Second Company",
        active=True,
    )

    db_session.add(other_company)
    db_session.flush()

    other_membership = CompanyMembership(
        user_id=data["user"].id,
        company_id=other_company.id,
        status=CompanyMembershipStatus.ACTIVE,
    )

    db_session.add(other_membership)
    db_session.flush()

    with pytest.raises(HTTPException) as exc_info:
        service.get_latest_results(
            user_id=data["user"].id,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == (
        "Company selection is required"
    )

    # Al seleccionar la empresa original, se recuperan sus resultados.
    result = service.get_latest_results(
        user_id=data["user"].id,
        company_id=data["company"].id,
    )

    assert result["evaluation_id"] == submitted["evaluation_id"]


def test_get_latest_results_isolated_by_company(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    # Primera evaluación en la empresa original.
    first_result = service.submit_evaluation(
        {
            "company_id": data["company"].id,
            "responses": build_responses(data),
        },
        data["user"].id,
    )

    # Crear una segunda empresa y asociar al mismo usuario.
    other_company = Company(
        name=f"Second Company {uuid4().hex}",
        active=True,
    )

    db_session.add(other_company)
    db_session.flush()

    other_membership = CompanyMembership(
        user_id=data["user"].id,
        company_id=other_company.id,
        role=CompanyRole.ASG_MANAGER,
        status=CompanyMembershipStatus.ACTIVE,
    )

    db_session.add(other_membership)
    db_session.flush()

    # Segunda evaluación en la otra empresa.
    second_result = service.submit_evaluation(
        {
            "company_id": other_company.id,
            "responses": build_responses(data),
        },
        data["user"].id,
    )

    assert first_result["evaluation_id"] != second_result["evaluation_id"]

    # Cada consulta debe devolver únicamente la evaluación
    # correspondiente a la empresa seleccionada.
    original_company_results = service.get_latest_results(
        user_id=data["user"].id,
        company_id=data["company"].id,
    )

    other_company_results = service.get_latest_results(
        user_id=data["user"].id,
        company_id=other_company.id,
    )

    assert original_company_results["evaluation_id"] == (
        first_result["evaluation_id"]
    )

    assert other_company_results["evaluation_id"] == (
        second_result["evaluation_id"]
    )


def test_get_evaluation_history_rejects_inactive_company_membership(
    db_session,
):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    submitted = service.submit_evaluation(
        {
            "company_id": data["company"].id,
            "responses": build_responses(data),
        },
        data["user"].id,
    )

    membership = (
        db_session.query(CompanyMembership)
        .filter(
            CompanyMembership.user_id == data["user"].id,
            CompanyMembership.company_id == data["company"].id,
        )
        .one()
    )

    membership.status = CompanyMembershipStatus.INACTIVE
    db_session.flush()

    with pytest.raises(HTTPException) as exc_info:
        service.get_evaluation_history(
            user_id=data["user"].id,
            company_id=data["company"].id,
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == (
        "User does not have an active membership in this company"
    )

    # La evaluación histórica debe conservarse.
    saved_evaluation = db_session.get(
        Evaluation,
        submitted["evaluation_id"],
    )

    assert saved_evaluation is not None
    assert saved_evaluation.company_id == data["company"].id


def test_get_evaluation_history_isolated_by_company(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    # Evaluación de la primera empresa.
    first_result = service.submit_evaluation(
        {
            "company_id": data["company"].id,
            "responses": build_responses(data),
        },
        data["user"].id,
    )

    # Segunda empresa con el mismo usuario.
    other_company = Company(
        name=f"Second Company {uuid4().hex}",
        active=True,
    )

    db_session.add(other_company)
    db_session.flush()

    db_session.add(
        CompanyMembership(
            user_id=data["user"].id,
            company_id=other_company.id,
            role=CompanyRole.ASG_MANAGER,
            status=CompanyMembershipStatus.ACTIVE,
        )
    )
    db_session.flush()

    # Evaluación de la segunda empresa.
    second_result = service.submit_evaluation(
        {
            "company_id": other_company.id,
            "responses": build_responses(data),
        },
        data["user"].id,
    )

    assert first_result["evaluation_id"] != second_result["evaluation_id"]

    first_history = service.get_evaluation_history(
        user_id=data["user"].id,
        company_id=data["company"].id,
    )

    second_history = service.get_evaluation_history(
        user_id=data["user"].id,
        company_id=other_company.id,
    )

    # Cada historial contiene exclusivamente su evaluación.
    assert [
        item["evaluation_id"]
        for item in first_history["history"]
    ] == [first_result["evaluation_id"]]

    assert [
        item["evaluation_id"]
        for item in second_history["history"]
    ] == [second_result["evaluation_id"]]

    # Los promedios globales se calculan utilizando
    # únicamente las evaluaciones de cada empresa.
    assert first_history["averages"]["global_score"] == (
        first_history["history"][0]["global_score"]
    )

    assert second_history["averages"]["global_score"] == (
        second_history["history"][0]["global_score"]
    )

    # Cada ámbito utiliza exclusivamente las puntuaciones
    # presentes en el historial de su empresa.
    for company_history in (first_history, second_history):
        expected_averages = {
            ambit["ambit_id"]: ambit["score"]
            for ambit in company_history["history"][0]["ambits"]
        }

        actual_averages = {
            ambit["ambit_id"]: ambit["score"]
            for ambit in company_history["averages"]["ambits"]
        }

        assert actual_averages == expected_averages

def test_get_historical_dashboard_rejects_inactive_company_membership(
    db_session,
):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    submitted = service.submit_evaluation(
        {
            "company_id": data["company"].id,
            "responses": build_responses(data),
        },
        data["user"].id,
    )

    membership = (
        db_session.query(CompanyMembership)
        .filter(
            CompanyMembership.user_id == data["user"].id,
            CompanyMembership.company_id == data["company"].id,
        )
        .one()
    )

    membership.status = CompanyMembershipStatus.INACTIVE
    db_session.flush()

    with pytest.raises(HTTPException) as exc_info:
        service.get_historical_dashboard(
            user_id=data["user"].id,
            company_id=data["company"].id,
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == (
        "User does not have an active membership in this company"
    )

    # La evaluación histórica debe conservarse.
    saved_evaluation = db_session.get(
        Evaluation,
        submitted["evaluation_id"],
    )

    assert saved_evaluation is not None
    assert saved_evaluation.company_id == data["company"].id


def test_get_historical_dashboard_isolated_by_company(db_session):
    data = create_evaluation_data(db_session)
    service = EvaluationService(db_session)

    first_result = service.submit_evaluation(
        {
            "company_id": data["company"].id,
            "responses": build_responses(data),
        },
        data["user"].id,
    )

    other_company = Company(
        name=f"Second Company {uuid4().hex}",
        active=True,
    )

    db_session.add(other_company)
    db_session.flush()

    db_session.add(
        CompanyMembership(
            user_id=data["user"].id,
            company_id=other_company.id,
            role=CompanyRole.ASG_MANAGER,
            status=CompanyMembershipStatus.ACTIVE,
        )
    )
    db_session.flush()

    second_result = service.submit_evaluation(
        {
            "company_id": other_company.id,
            "responses": build_responses(data),
        },
        data["user"].id,
    )

    assert first_result["evaluation_id"] != second_result["evaluation_id"]

    first_dashboard = service.get_historical_dashboard(
        user_id=data["user"].id,
        company_id=data["company"].id,
    )

    second_dashboard = service.get_historical_dashboard(
        user_id=data["user"].id,
        company_id=other_company.id,
    )

    assert [
        item["evaluation_id"]
        for item in first_dashboard["history"]
    ] == [first_result["evaluation_id"]]

    assert [
        item["evaluation_id"]
        for item in second_dashboard["history"]
    ] == [second_result["evaluation_id"]]

    # Al existir una evaluación por empresa,
    # no deben calcularse variaciones entre ellas.
    for dashboard in (first_dashboard, second_dashboard):
        assert len(dashboard["history"]) == 1

        evaluation = dashboard["history"][0]

        assert evaluation["global_delta"] is None

        assert all(
            ambit["delta"] is None
            for ambit in evaluation["ambits"]
        )


@pytest.mark.parametrize(
    "role, allowed",
    [
        (CompanyRole.COMPANY_ADMIN, True),
        (CompanyRole.ASG_MANAGER, True),
        (CompanyRole.COLLABORATOR, True),
        (CompanyRole.AUDITOR, False),
    ],
)
def test_save_draft_enforces_company_roles(
    db_session,
    role,
    allowed,
):
    data = create_evaluation_data(db_session)

    data["membership"].role = role
    db_session.flush()

    service = EvaluationService(db_session)

    payload = {
        "responses": build_responses(data)[:2],
    }

    if allowed:
        result = service.save_draft(
            payload,
            data["user"].id,
        )

        evaluation = db_session.get(
            Evaluation,
            result["evaluation_id"],
        )

        assert evaluation is not None
        assert evaluation.status == EvaluationStatus.DRAFT
        assert evaluation.user_id == data["user"].id
        assert evaluation.company_id == data["company"].id

    else:
        with pytest.raises(HTTPException) as exc:
            service.save_draft(
                payload,
                data["user"].id,
            )

        assert exc.value.status_code == 403
        assert exc.value.detail == (
            "Insufficient company permissions"
        )

        evaluations = (
            db_session.query(Evaluation)
            .filter(
                Evaluation.user_id == data["user"].id,
                Evaluation.company_id == data["company"].id,
            )
            .all()
        )

        assert evaluations == []


@pytest.mark.parametrize(
    "role, allowed",
    [
        (CompanyRole.COMPANY_ADMIN, True),
        (CompanyRole.ASG_MANAGER, True),
        (CompanyRole.COLLABORATOR, True),
        (CompanyRole.AUDITOR, False),
    ],
)
def test_get_draft_enforces_company_roles(
    db_session,
    role,
    allowed,
):
    data = create_evaluation_data(db_session)

    data["membership"].role = role
    db_session.flush()

    service = EvaluationService(db_session)

    if allowed:
        result = service.get_draft(
            user_id=data["user"].id,
            company_id=data["company"].id,
        )

        # No existe un borrador: la consulta debe estar
        # autorizada y devolver None.
        assert result is None

    else:
        with pytest.raises(HTTPException) as exc:
            service.get_draft(
                user_id=data["user"].id,
                company_id=data["company"].id,
            )

        assert exc.value.status_code == 403
        assert exc.value.detail == (
            "Insufficient company permissions"
        )


@pytest.mark.parametrize(
    "role, allowed",
    [
        (CompanyRole.COMPANY_ADMIN, True),
        (CompanyRole.ASG_MANAGER, True),
        (CompanyRole.COLLABORATOR, False),
        (CompanyRole.AUDITOR, False),
    ],
)
def test_submit_evaluation_enforces_company_roles(
    db_session,
    role,
    allowed,
):
    data = create_evaluation_data(db_session)

    data["membership"].role = role
    db_session.flush()

    service = EvaluationService(db_session)

    payload = {
        "company_id": data["company"].id,
        "responses": build_responses(data),
    }

    if allowed:
        result = service.submit_evaluation(
            payload,
            data["user"].id,
        )

        evaluation = db_session.get(
            Evaluation,
            result["evaluation_id"],
        )

        assert evaluation is not None
        assert evaluation.status == EvaluationStatus.COMPLETED
        assert evaluation.user_id == data["user"].id
        assert evaluation.company_id == data["company"].id

    else:
        with pytest.raises(HTTPException) as exc:
            service.submit_evaluation(
                payload,
                data["user"].id,
            )

        assert exc.value.status_code == 403
        assert exc.value.detail == (
            "Insufficient company permissions"
        )

        evaluations = (
            db_session.query(Evaluation)
            .filter(
                Evaluation.user_id == data["user"].id,
                Evaluation.company_id == data["company"].id,
            )
            .all()
        )

        assert evaluations == []
