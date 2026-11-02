
import pytest
from fastapi import HTTPException

from app.main import app
from app.models.evaluation_model import Evaluation, EvaluationStatus
from app.services.evaluations_service import EvaluationService
from app.services.token_service import get_current_user
from app.models.evaluation_ambit_score_model import EvaluationAmbitScore
from tests.test_evaluation import create_evaluation_data
from app.models.methodology_model import Methodology, MethodologyStatus

@pytest.fixture
def comparison_data(db_session):
    data = create_evaluation_data(db_session)

    first = Evaluation(
        user_id=data["user"].id,
        methodology_id=data["methodology"].id,
        status=EvaluationStatus.COMPLETED,
        global_score=7.5,
    )

    second = Evaluation(
        user_id=data["user"].id,
        methodology_id=data["methodology"].id,
        status=EvaluationStatus.COMPLETED,
        global_score=8.5,
    )

    db_session.add_all([first, second])
    db_session.flush()
    db_session.add_all([
        EvaluationAmbitScore(
            evaluation_id=first.id,
            ambit_id=data["ambits"][0].id,
            score=7.0,
            maturity_level_id=data["maturity_levels"][0].id,
        ),
        EvaluationAmbitScore(
            evaluation_id=second.id,
            ambit_id=data["ambits"][0].id,
            score=8.0,
            maturity_level_id=data["maturity_levels"][1].id,
        ),
    ])
    db_session.flush()
    return {
        **data,
        "first": first,
        "second": second,
    }


def test_get_comparison_returns_evaluations(
    db_session,
    comparison_data,
):
    data = comparison_data

    result = EvaluationService(db_session).get_comparison(
        data["first"].id,
        data["second"].id,
        data["user"].id,
    )

    assert result["comparable"] is True
    assert result["warning"] is None

    assert [
        evaluation["evaluation_id"]
        for evaluation in result["evaluations"]
    ] == [
        data["first"].id,
        data["second"].id,
    ]

    assert [
        evaluation["global_score"]
        for evaluation in result["evaluations"]
    ] == [7.5, 8.5]

    assert all(
        evaluation["methodology_id"]
        == data["methodology"].id
        for evaluation in result["evaluations"]
    )
    assert result["evaluations"][0]["ambits"] == [
        {
            "ambit_id": data["ambits"][0].id,
            "ambit_name": "Ambiental",
            "score": 7.0,
        }
    ]

    assert result["evaluations"][1]["ambits"] == [
        {
            "ambit_id": data["ambits"][0].id,
            "ambit_name": "Ambiental",
            "score": 8.0,
        }
    ]


def test_get_comparison_rejects_same_evaluation(
    db_session,
    comparison_data,
):
    data = comparison_data

    with pytest.raises(HTTPException) as exc:
        EvaluationService(db_session).get_comparison(
            data["first"].id,
            data["first"].id,
            data["user"].id,
        )

    assert exc.value.status_code == 400


def test_get_comparison_rejects_missing_evaluation(
    db_session,
    comparison_data,
):
    data = comparison_data

    with pytest.raises(HTTPException) as exc:
        EvaluationService(db_session).get_comparison(
            data["first"].id,
            -1,
            data["user"].id,
        )

    assert exc.value.status_code == 404


def test_get_comparison_rejects_other_user(
    db_session,
    comparison_data,
):
    data = comparison_data

    with pytest.raises(HTTPException) as exc:
        EvaluationService(db_session).get_comparison(
            data["first"].id,
            data["second"].id,
            -1,
        )

    assert exc.value.status_code == 404


def test_get_comparison_rejects_draft(
    db_session,
    comparison_data,
):
    data = comparison_data
    data["second"].status = EvaluationStatus.DRAFT
    db_session.flush()

    with pytest.raises(HTTPException) as exc:
        EvaluationService(db_session).get_comparison(
            data["first"].id,
            data["second"].id,
            data["user"].id,
        )

    assert exc.value.status_code == 404


def test_comparison_endpoint_requires_authentication(client):
    response = client.get(
        "/api/evaluations/compare",
        params={
            "evaluation_id_1": 1,
            "evaluation_id_2": 2,
        },
    )

    assert response.status_code == 401


def test_comparison_endpoint_returns_evaluations(
    client,
    comparison_data,
):
    data = comparison_data

    app.dependency_overrides[get_current_user] = (
        lambda: data["user"]
    )

    try:
        response = client.get(
            "/api/evaluations/compare",
            params={
                "evaluation_id_1": data["first"].id,
                "evaluation_id_2": data["second"].id,
            },
        )

        assert response.status_code == 200

        result = response.json()

        assert result["comparable"] is True
        assert len(result["evaluations"]) == 2
        assert result["differences"]["global_score"] == 1.0

        assert result["differences"]["ambits"] == [
            {
                "ambit_id": data["ambits"][0].id,
                "ambit_name": "Ambiental",
                "delta": 1.0,
            }
        ]

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_get_comparison_warns_about_different_methodologies(
    db_session,
    comparison_data,
):
    data = comparison_data

    second_methodology = Methodology(
        name="Comparison Test Methodology",
        version="TEST-COMPARISON-2",
        status=MethodologyStatus.PUBLISHED,
        is_active=False,
    )

    db_session.add(second_methodology)
    db_session.flush()

    data["second"].methodology_id = second_methodology.id
    db_session.flush()

    result = EvaluationService(db_session).get_comparison(
        data["first"].id,
        data["second"].id,
        data["user"].id,
    )

    assert result["comparable"] is False
    assert result["warning"] is not None

    assert [
        evaluation["methodology_id"]
        for evaluation in result["evaluations"]
    ] == [
        data["methodology"].id,
        second_methodology.id,
    ]

    assert [
        evaluation["global_score"]
        for evaluation in result["evaluations"]
    ] == [7.5, 8.5]

    assert result["differences"] is None

@pytest.mark.parametrize(
    "first_score, second_score, expected_delta",
    [
        (7.0, 8.0, 1.0),
        (9.0, 7.0, -2.0),
        (8.0, 8.0, 0.0),
    ],
)
def test_calculate_comparison_global_differences(
    first_score,
    second_score,
    expected_delta,
):
    first = {
        "global_score": first_score,
        "ambits": [],
    }

    second = {
        "global_score": second_score,
        "ambits": [],
    }

    result = EvaluationService.calculate_comparison_differences(
        first,
        second,
    )

    assert result["global_score"] == expected_delta
    assert result["ambits"] == []


def test_calculate_comparison_ambit_differences():
    first = {
        "global_score": 7.0,
        "ambits": [
            {
                "ambit_id": 1,
                "ambit_name": "Ambiental",
                "score": 7.0,
            },
            {
                "ambit_id": 2,
                "ambit_name": "Social",
                "score": 8.0,
            },
            {
                "ambit_id": 3,
                "ambit_name": "Gobernanza",
                "score": 6.0,
            },
        ],
    }

    second = {
        "global_score": 8.0,
        "ambits": [
            {
                "ambit_id": 3,
                "ambit_name": "Gobernanza",
                "score": 7.0,
            },
            {
                "ambit_id": 1,
                "ambit_name": "Ambiental",
                "score": 8.0,
            },
            {
                "ambit_id": 2,
                "ambit_name": "Social",
                "score": 7.0,
            },
        ],
    }

    result = EvaluationService.calculate_comparison_differences(
        first,
        second,
    )

    assert result["global_score"] == 1.0

    assert result["ambits"] == [
        {
            "ambit_id": 1,
            "ambit_name": "Ambiental",
            "delta": 1.0,
        },
        {
            "ambit_id": 2,
            "ambit_name": "Social",
            "delta": -1.0,
        },
        {
            "ambit_id": 3,
            "ambit_name": "Gobernanza",
            "delta": 1.0,
        },
    ]


def test_calculate_comparison_rejects_incompatible_ambits():
    first = {
        "global_score": 7.0,
        "ambits": [
            {
                "ambit_id": 1,
                "ambit_name": "Ambiental",
                "score": 7.0,
            },
            {
                "ambit_id": 2,
                "ambit_name": "Social",
                "score": 8.0,
            },
        ],
    }

    second = {
        "global_score": 8.0,
        "ambits": [
            {
                "ambit_id": 1,
                "ambit_name": "Ambiental",
                "score": 8.0,
            },
        ],
    }

    with pytest.raises(HTTPException) as exc:
        EvaluationService.calculate_comparison_differences(
            first,
            second,
        )

    assert exc.value.status_code == 409
    assert exc.value.detail == "Evaluation ambits are not compatible"

def test_get_comparison_preserves_historical_scores(
    db_session,
    comparison_data,
):
    data = comparison_data

    evaluation_ids = [
        data["first"].id,
        data["second"].id,
    ]

    def get_stored_scores():
        evaluations = (
            db_session.query(Evaluation)
            .filter(Evaluation.id.in_(evaluation_ids))
            .order_by(Evaluation.id)
            .all()
        )

        ambits = (
            db_session.query(EvaluationAmbitScore)
            .filter(
                EvaluationAmbitScore.evaluation_id.in_(
                    evaluation_ids
                )
            )
            .order_by(
                EvaluationAmbitScore.evaluation_id,
                EvaluationAmbitScore.ambit_id,
            )
            .all()
        )

        return {
            "evaluations": [
                (
                    evaluation.id,
                    evaluation.global_score,
                    evaluation.status,
                    evaluation.methodology_id,
                )
                for evaluation in evaluations
            ],
            "ambits": [
                (
                    ambit.evaluation_id,
                    ambit.ambit_id,
                    ambit.score,
                    ambit.maturity_level_id,
                )
                for ambit in ambits
            ],
        }

    scores_before = get_stored_scores()

    result = EvaluationService(db_session).get_comparison(
        data["first"].id,
        data["second"].id,
        data["user"].id,
    )

    db_session.flush()
    db_session.expire_all()

    scores_after = get_stored_scores()

    assert result["comparable"] is True
    assert result["differences"]["global_score"] == 1.0

    assert scores_after == scores_before


def test_get_comparison_with_different_methodology_versions(
    db_session,
    comparison_data,
):
    data = comparison_data

    previous_methodology = data["methodology"]

    # Representar una versión metodológica anterior.
    previous_methodology.is_active = False
    previous_methodology.status = MethodologyStatus.ARCHIVED

    # Crear una nueva versión publicada.
    new_methodology = Methodology(
        name=previous_methodology.name,
        version="TEST-COMPARISON-V2",
        status=MethodologyStatus.PUBLISHED,
        is_active=True,
    )

    db_session.add(new_methodology)
    db_session.flush()

    # La segunda evaluación pertenece a la nueva versión.
    data["second"].methodology_id = new_methodology.id
    db_session.flush()

    result = EvaluationService(db_session).get_comparison(
        data["first"].id,
        data["second"].id,
        data["user"].id,
    )

    assert result["comparable"] is False
    assert result["warning"] is not None
    assert result["differences"] is None

    first_result, second_result = result["evaluations"]

    assert first_result["methodology_id"] == previous_methodology.id
    assert second_result["methodology_id"] == new_methodology.id

    assert first_result["methodology_version"] == previous_methodology.version
    assert second_result["methodology_version"] == "TEST-COMPARISON-V2"

    assert first_result["global_score"] == 7.5
    assert second_result["global_score"] == 8.5

    assert first_result["ambits"][0]["score"] == 7.0
    assert second_result["ambits"][0]["score"] == 8.0
