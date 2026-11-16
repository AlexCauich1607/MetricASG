
from copy import deepcopy

import pytest

from app.models.ai_explanation_request import AIExplanationRequest
from tests.fixtures.ai_explanation_quality_cases import (
    BASE_EVALUATION,
    QUALITY_CASES,
)


@pytest.mark.parametrize(
    "case",
    QUALITY_CASES,
    ids=lambda case: case["id"],
)
def test_quality_case_has_valid_structure(case):
    payload = deepcopy(BASE_EVALUATION)
    payload.update(deepcopy(case["overrides"]))

    request = AIExplanationRequest.model_validate(payload)

    assert request.evaluation.id == 999
    assert request.global_result.score == 8.5
    assert request.global_result.maturity_level == "Intermedio"
    assert len(request.ambits) >= 1


def test_quality_cases_have_unique_identifiers():
    identifiers = [case["id"] for case in QUALITY_CASES]

    assert len(identifiers) == 5
    assert len(identifiers) == len(set(identifiers))


def test_registered_gaps_case_contains_expected_priority():
    case = next(
        case
        for case in QUALITY_CASES
        if case["id"] == "registered_gaps"
    )

    payload = deepcopy(BASE_EVALUATION)
    payload.update(deepcopy(case["overrides"]))

    request = AIExplanationRequest.model_validate(payload)

    assert len(request.gaps) == 1
    assert request.gaps[0].priority == "HIGH"
    assert request.gaps[0].description == (
        "Ausencia de seguimiento ambiental."
    )


def test_partial_results_do_not_invent_missing_ambits():
    case = next(
        case
        for case in QUALITY_CASES
        if case["id"] == "partial_results"
    )

    payload = deepcopy(BASE_EVALUATION)
    payload.update(deepcopy(case["overrides"]))

    request = AIExplanationRequest.model_validate(payload)

    assert [ambit.name for ambit in request.ambits] == [
        "Ambiental",
        "Social",
    ]
