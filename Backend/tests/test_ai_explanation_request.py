
from datetime import datetime
from math import inf, nan

import pytest
from pydantic import ValidationError

from app.models.ai_explanation_request import AIExplanationRequest


@pytest.fixture
def valid_payload():
    return {
        "evaluation": {
            "id": 1,
            "date": datetime(2026, 11, 13),
            "methodology": {
                "id": 1,
                "name": "Metodología ASG",
                "version": "1.0",
            },
        },
        "global_result": {
            "score": 7.8,
            "maturity_level": "Nivel de ejemplo",
        },
        "ambits": [
            {
                "id": 1,
                "name": "Ambiental",
                "score": 7.2,
                "maturity_level": "Nivel de ejemplo",
                "feedback": "Retroalimentación del ámbito",
            }
        ],
        "gaps": [
            {
                "indicator_id": 15,
                "description": "Brecha registrada",
                "priority": "HIGH",
            }
        ],
    }


def test_accepts_valid_payload(valid_payload):
    request = AIExplanationRequest.model_validate(valid_payload)

    assert request.evaluation.id == 1
    assert request.global_result.score == 7.8
    assert len(request.ambits) == 1
    assert len(request.gaps) == 1


def test_rejects_invalid_evaluation_id(valid_payload):
    valid_payload["evaluation"]["id"] = 0

    with pytest.raises(ValidationError):
        AIExplanationRequest.model_validate(valid_payload)


@pytest.mark.parametrize("invalid_score", [nan, inf, -inf])
@pytest.mark.parametrize("field", ["global_result", "ambits"])
def test_rejects_non_finite_scores(
    valid_payload,
    invalid_score,
    field,
):
    if field == "global_result":
        valid_payload["global_result"]["score"] = invalid_score
    else:
        valid_payload["ambits"][0]["score"] = invalid_score

    with pytest.raises(ValidationError):
        AIExplanationRequest.model_validate(valid_payload)


def test_rejects_invalid_priority(valid_payload):
    valid_payload["gaps"][0]["priority"] = "CRITICAL"

    with pytest.raises(ValidationError):
        AIExplanationRequest.model_validate(valid_payload)


def test_rejects_empty_ambits(valid_payload):
    valid_payload["ambits"] = []

    with pytest.raises(ValidationError):
        AIExplanationRequest.model_validate(valid_payload)


def test_accepts_empty_gaps(valid_payload):
    valid_payload["gaps"] = []

    request = AIExplanationRequest.model_validate(valid_payload)

    assert request.gaps == []
