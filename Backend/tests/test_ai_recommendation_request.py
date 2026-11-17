
from datetime import date, datetime
from math import inf, nan

import pytest
from pydantic import ValidationError

from app.models.ai_recommendation_request import (
    AIRecommendationRequest,
)


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
                "feedback": "Retroalimentación ambiental",
            }
        ],
        "gaps": [
            {
                "indicator_id": 15,
                "indicator_question": "¿Se mide el consumo de energía?",
                "indicator_answer": "Medición parcial",
                "maturity_level": "Nivel de ejemplo",
                "description": "No existe seguimiento periódico",
                "priority": "HIGH",
            }
        ],
        "existing_actions": [
            {
                "id": 10,
                "indicator_id": 15,
                "description": "Implementar medición mensual",
                "priority": "HIGH",
                "status": "IN_PROGRESS",
                "target_date": date(2026, 12, 15),
            }
        ],
        "constraints": {
            "budget": "Presupuesto limitado",
            "resources": "Equipo interno",
            "additional_context": "Priorizar acciones viables",
        },
    }


def test_accepts_valid_payload(valid_payload):
    request = AIRecommendationRequest.model_validate(valid_payload)

    assert request.evaluation.id == 1
    assert request.global_result.score == 7.8
    assert len(request.ambits) == 1
    assert len(request.gaps) == 1
    assert len(request.existing_actions) == 1
    assert request.existing_actions[0].status == "IN_PROGRESS"
    assert request.constraints.budget == "Presupuesto limitado"


@pytest.mark.parametrize("field", ["evaluation", "existing_actions"])
def test_rejects_invalid_ids(valid_payload, field):
    if field == "evaluation":
        valid_payload["evaluation"]["id"] = 0
    else:
        valid_payload["existing_actions"][0]["id"] = 0

    with pytest.raises(ValidationError):
        AIRecommendationRequest.model_validate(valid_payload)


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
        AIRecommendationRequest.model_validate(valid_payload)


@pytest.mark.parametrize("field", ["gaps", "existing_actions"])
def test_rejects_invalid_priority(valid_payload, field):
    valid_payload[field][0]["priority"] = "CRITICAL"

    with pytest.raises(ValidationError):
        AIRecommendationRequest.model_validate(valid_payload)


def test_rejects_invalid_action_status(valid_payload):
    valid_payload["existing_actions"][0]["status"] = "UNKNOWN"

    with pytest.raises(ValidationError):
        AIRecommendationRequest.model_validate(valid_payload)


def test_rejects_empty_ambits(valid_payload):
    valid_payload["ambits"] = []

    with pytest.raises(ValidationError):
        AIRecommendationRequest.model_validate(valid_payload)


def test_accepts_empty_gaps_and_actions(valid_payload):
    valid_payload["gaps"] = []
    valid_payload["existing_actions"] = []

    request = AIRecommendationRequest.model_validate(valid_payload)

    assert request.gaps == []
    assert request.existing_actions == []


def test_accepts_missing_optional_constraints(valid_payload):
    valid_payload.pop("constraints")

    request = AIRecommendationRequest.model_validate(valid_payload)

    assert request.constraints.budget is None
    assert request.constraints.resources is None
    assert request.constraints.additional_context is None


def test_accepts_gap_without_indicator(valid_payload):
    valid_payload["gaps"][0]["indicator_id"] = None
    valid_payload["gaps"][0]["indicator_question"] = None
    valid_payload["gaps"][0]["indicator_answer"] = None

    request = AIRecommendationRequest.model_validate(valid_payload)

    assert request.gaps[0].indicator_id is None


def test_rejects_missing_action_description(valid_payload):
    valid_payload["existing_actions"][0]["description"] = ""

    with pytest.raises(ValidationError):
        AIRecommendationRequest.model_validate(valid_payload)


def test_rejects_invalid_gap_indicator_id(valid_payload):
    valid_payload["gaps"][0]["indicator_id"] = -1

    with pytest.raises(ValidationError):
        AIRecommendationRequest.model_validate(valid_payload)
