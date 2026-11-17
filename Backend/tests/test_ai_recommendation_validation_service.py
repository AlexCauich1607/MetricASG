
import json
from datetime import datetime

import pytest
from fastapi import HTTPException

from app.models.ai_recommendation_request import AIRecommendationRequest
from app.services.ai_recommendation_validation_service import (
    AIRecommendationValidationService,
)


@pytest.fixture
def context():
    return AIRecommendationRequest.model_validate({
        "evaluation": {
            "id": 10,
            "date": datetime(2026, 11, 17),
            "methodology": {
                "id": 2,
                "name": "Metodología ASG",
                "version": "1.0",
            },
        },
        "global_result": {
            "score": 7.8,
            "maturity_level": "Nivel de prueba",
        },
        "ambits": [
            {
                "id": 1,
                "name": "Ambiental",
                "score": 7.2,
                "maturity_level": "Nivel de prueba",
            }
        ],
        "gaps": [
            {
                "indicator_id": 15,
                "description": "Falta seguimiento energético",
                "priority": "HIGH",
            }
        ],
    })


@pytest.fixture
def valid_payload():
    return {
        "recommendations": [
            {
                "indicator_id": 15,
                "gap_description": "Falta seguimiento energético",
                "title": "Implementar monitoreo energético",
                "description": "Registrar consumos mensuales",
                "justification": "Atiende la brecha identificada",
                "priority": "HIGH",
            }
        ]
    }


def validate_payload(payload, context):
    return AIRecommendationValidationService().validate(
        raw_response=json.dumps(payload),
        context=context,
    )


def test_accepts_valid_recommendation(context, valid_payload):
    result = validate_payload(valid_payload, context)

    assert len(result.recommendations) == 1
    assert result.recommendations[0].indicator_id == 15
    assert result.recommendations[0].priority == "HIGH"


def test_accepts_empty_recommendations(context):
    result = validate_payload(
        {"recommendations": []},
        context,
    )

    assert result.recommendations == []


def test_rejects_invalid_json(context):
    with pytest.raises(HTTPException) as exc:
        AIRecommendationValidationService().validate(
            raw_response="{invalid-json",
            context=context,
        )

    assert exc.value.status_code == 422


def test_rejects_missing_recommendations_property(context):
    with pytest.raises(HTTPException) as exc:
        validate_payload({}, context)

    assert exc.value.status_code == 422


def test_rejects_non_object_root(context):
    with pytest.raises(HTTPException) as exc:
        validate_payload([], context)

    assert exc.value.status_code == 422


def test_rejects_unregistered_indicator(context, valid_payload):
    valid_payload["recommendations"][0]["indicator_id"] = 99

    with pytest.raises(HTTPException) as exc:
        validate_payload(valid_payload, context)

    assert exc.value.status_code == 422


def test_rejects_unregistered_gap(context, valid_payload):
    valid_payload["recommendations"][0]["gap_description"] = (
        "Brecha inexistente"
    )

    with pytest.raises(HTTPException) as exc:
        validate_payload(valid_payload, context)

    assert exc.value.status_code == 422


def test_rejects_changed_priority(context, valid_payload):
    valid_payload["recommendations"][0]["priority"] = "LOW"

    with pytest.raises(HTTPException) as exc:
        validate_payload(valid_payload, context)

    assert exc.value.status_code == 422


def test_rejects_unexpected_score(context, valid_payload):
    valid_payload["recommendations"][0]["new_score"] = 100

    with pytest.raises(HTTPException) as exc:
        validate_payload(valid_payload, context)

    assert exc.value.status_code == 422


def test_rejects_recommendation_without_registered_gaps(
    context,
    valid_payload,
):
    context.gaps = []

    with pytest.raises(HTTPException) as exc:
        validate_payload(valid_payload, context)

    assert exc.value.status_code == 422


def test_accepts_empty_recommendations_without_gaps(context):
    context.gaps = []

    result = validate_payload(
        {"recommendations": []},
        context,
    )

    assert result.recommendations == []


def test_preserves_official_scores(context, valid_payload):
    original_global_score = context.global_result.score
    original_ambit_score = context.ambits[0].score

    validate_payload(valid_payload, context)

    assert context.global_result.score == original_global_score
    assert context.ambits[0].score == original_ambit_score


def test_rejects_unexpected_root_field(context, valid_payload):
    valid_payload["global_score"] = 9.5

    with pytest.raises(HTTPException) as exc:
        validate_payload(valid_payload, context)

    assert exc.value.status_code == 422

def test_rejects_duplicate_recommendations(context, valid_payload):
    duplicate = valid_payload["recommendations"][0].copy()
    duplicate["title"] = duplicate["title"].upper()

    valid_payload["recommendations"].append(duplicate)

    with pytest.raises(HTTPException) as exc:
        validate_payload(valid_payload, context)

    assert exc.value.status_code == 422
    assert exc.value.detail == "Duplicate AI recommendation"
