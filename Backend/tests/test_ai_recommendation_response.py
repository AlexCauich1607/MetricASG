
import pytest
from pydantic import ValidationError

from app.models.ai_recommendation_response import (
    AIRecommendationResponse,
)


@pytest.fixture
def valid_payload():
    return {
        "recommendations": [
            {
                "indicator_id": 15,
                "gap_description": "Falta seguimiento periódico",
                "title": "Implementar seguimiento energético",
                "description": "Establecer revisiones mensuales",
                "justification": "Atiende la brecha registrada",
                "priority": "HIGH",
            }
        ]
    }


def test_accepts_valid_recommendations(valid_payload):
    response = AIRecommendationResponse.model_validate(valid_payload)

    assert len(response.recommendations) == 1
    assert response.recommendations[0].indicator_id == 15
    assert response.recommendations[0].priority == "HIGH"


def test_accepts_empty_recommendations():
    response = AIRecommendationResponse.model_validate(
        {"recommendations": []}
    )

    assert response.recommendations == []


def test_accepts_recommendation_without_indicator(valid_payload):
    valid_payload["recommendations"][0]["indicator_id"] = None

    response = AIRecommendationResponse.model_validate(valid_payload)

    assert response.recommendations[0].indicator_id is None


@pytest.mark.parametrize("indicator_id", [0, -1])
def test_rejects_invalid_indicator_id(valid_payload, indicator_id):
    valid_payload["recommendations"][0]["indicator_id"] = indicator_id

    with pytest.raises(ValidationError):
        AIRecommendationResponse.model_validate(valid_payload)


@pytest.mark.parametrize(
    "field",
    ["gap_description", "title", "description", "justification"],
)
def test_rejects_empty_required_text(valid_payload, field):
    valid_payload["recommendations"][0][field] = ""

    with pytest.raises(ValidationError):
        AIRecommendationResponse.model_validate(valid_payload)


def test_rejects_invalid_priority(valid_payload):
    valid_payload["recommendations"][0]["priority"] = "CRITICAL"

    with pytest.raises(ValidationError):
        AIRecommendationResponse.model_validate(valid_payload)


@pytest.mark.parametrize(
    "field",
    ["global_score", "new_score", "maturity_level"],
)
def test_rejects_unexpected_score_fields(valid_payload, field):
    valid_payload["recommendations"][0][field] = 100

    with pytest.raises(ValidationError):
        AIRecommendationResponse.model_validate(valid_payload)


def test_rejects_unexpected_root_fields(valid_payload):
    valid_payload["evaluation_score"] = 9.5

    with pytest.raises(ValidationError):
        AIRecommendationResponse.model_validate(valid_payload)


def test_rejects_missing_required_fields(valid_payload):
    del valid_payload["recommendations"][0]["justification"]

    with pytest.raises(ValidationError):
        AIRecommendationResponse.model_validate(valid_payload)
