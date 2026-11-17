
from datetime import date

import pytest
from pydantic import ValidationError

from app.models.ai_recommendation_acceptance_request import (
    AIRecommendationAcceptanceRequest,
)


def build_valid_acceptance():
    return {
        "decision": "ACCEPT",
        "recommendation_id": 1,
        "responsible": "Coordinador ASG",
        "target_date": date(2026, 12, 15),
    }


def test_accepts_valid_acceptance():
    request = AIRecommendationAcceptanceRequest.model_validate(
        build_valid_acceptance()
    )

    assert request.decision == "ACCEPT"
    assert request.recommendation_id == 1
    assert request.responsible == "Coordinador ASG"
    assert request.target_date == date(2026, 12, 15)


def test_accepts_edited_description_and_priority():
    payload = build_valid_acceptance()
    payload["description"] = "Implementar seguimiento mensual"
    payload["priority"] = "HIGH"

    request = AIRecommendationAcceptanceRequest.model_validate(
        payload
    )

    assert request.description == "Implementar seguimiento mensual"
    assert request.priority.value == "HIGH"


def test_accepts_valid_rejection():
    request = AIRecommendationAcceptanceRequest.model_validate(
        {
            "decision": "REJECT",
            "recommendation_id": 1,
        }
    )

    assert request.decision == "REJECT"
    assert request.responsible is None
    assert request.target_date is None


def test_rejects_acceptance_without_responsible():
    payload = build_valid_acceptance()
    del payload["responsible"]

    with pytest.raises(ValidationError):
        AIRecommendationAcceptanceRequest.model_validate(payload)


def test_rejects_acceptance_without_target_date():
    payload = build_valid_acceptance()
    del payload["target_date"]

    with pytest.raises(ValidationError):
        AIRecommendationAcceptanceRequest.model_validate(payload)


@pytest.mark.parametrize(
    "field,value",
    [
        ("description", "Nueva descripción"),
        ("priority", "LOW"),
        ("responsible", "Coordinador ASG"),
        ("target_date", date(2026, 12, 15)),
    ],
)
def test_rejects_action_fields_on_rejection(field, value):
    payload = {
        "decision": "REJECT",
        "recommendation_id": 1,
        field: value,
    }

    with pytest.raises(ValidationError):
        AIRecommendationAcceptanceRequest.model_validate(payload)


@pytest.mark.parametrize("recommendation_id", [0, -1])
def test_rejects_invalid_recommendation_id(recommendation_id):
    payload = build_valid_acceptance()
    payload["recommendation_id"] = recommendation_id

    with pytest.raises(ValidationError):
        AIRecommendationAcceptanceRequest.model_validate(payload)


@pytest.mark.parametrize(
    "field",
    ["description", "responsible"],
)
def test_rejects_blank_text(field):
    payload = build_valid_acceptance()
    payload[field] = "   "

    with pytest.raises(ValidationError):
        AIRecommendationAcceptanceRequest.model_validate(payload)


def test_trims_human_editable_text():
    payload = build_valid_acceptance()
    payload["description"] = "  Acción revisada  "
    payload["responsible"] = "  Coordinador ASG  "

    request = AIRecommendationAcceptanceRequest.model_validate(payload)

    assert request.description == "Acción revisada"
    assert request.responsible == "Coordinador ASG"


def test_rejects_invalid_decision():
    payload = build_valid_acceptance()
    payload["decision"] = "APPROVE"

    with pytest.raises(ValidationError):
        AIRecommendationAcceptanceRequest.model_validate(payload)


def test_rejects_unexpected_fields():
    payload = build_valid_acceptance()
    payload["global_score"] = 100

    with pytest.raises(ValidationError):
        AIRecommendationAcceptanceRequest.model_validate(payload)
