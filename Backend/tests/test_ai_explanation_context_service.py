
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException

from app.services.ai_explanation_context_service import (
    AIExplanationContextService,
)


def build_results():
    return {
        "evaluation_id": 10,
        "date": datetime(2026, 11, 16, tzinfo=timezone.utc),
        "global_score": 7.8,
        "global_maturity_level": "Nivel de prueba",
        "ambits": [
            {
                "ambit_id": 1,
                "ambit_name": "Ambiental",
                "score": 7.2,
                "maturity_level": "Nivel de prueba",
                "feedback": "Resultado de prueba",
            }
        ],
    }


def build_evaluation():
    return SimpleNamespace(
        id=10,
        date=datetime(2026, 11, 16, tzinfo=timezone.utc),
        methodology=SimpleNamespace(
            id=2,
            name="Metodología de prueba",
            version="1.0",
        ),
    )


def test_build_context_preserves_official_results():
    db = Mock()
    db.get.return_value = build_evaluation()

    with (
        patch(
            "app.services.ai_explanation_context_service."
            "EvaluationService"
        ) as evaluation_service,
        patch(
            "app.services.ai_explanation_context_service."
            "ImprovementActionService"
        ) as improvement_service,
    ):
        evaluation_service.return_value.get_results_by_id.return_value = (
            build_results()
        )
        improvement_service.return_value.list_actions.return_value = []

        context = AIExplanationContextService(db).build_context(
            evaluation_id=10,
            user_id=5,
        )

        assert context.evaluation.id == 10
        assert context.evaluation.methodology.version == "1.0"
        assert context.global_result.score == 7.8
        assert context.ambits[0].score == 7.2
        assert context.gaps == []

        evaluation_service.return_value.get_results_by_id.assert_called_once_with(
            evaluation_id=10,
            user_id=5,
        )
        improvement_service.return_value.list_actions.assert_called_once_with(
            evaluation_id=10,
            user_id=5,
        )


def test_build_context_maps_registered_gaps():
    db = Mock()
    db.get.return_value = build_evaluation()

    action = SimpleNamespace(
        indicator_id=15,
        gap_description="Brecha registrada de prueba",
        priority=SimpleNamespace(value="HIGH"),
    )

    with (
        patch(
            "app.services.ai_explanation_context_service."
            "EvaluationService"
        ) as evaluation_service,
        patch(
            "app.services.ai_explanation_context_service."
            "ImprovementActionService"
        ) as improvement_service,
    ):
        evaluation_service.return_value.get_results_by_id.return_value = (
            build_results()
        )
        improvement_service.return_value.list_actions.return_value = [action]

        context = AIExplanationContextService(db).build_context(10, 5)

        assert len(context.gaps) == 1
        assert context.gaps[0].indicator_id == 15
        assert context.gaps[0].description == "Brecha registrada de prueba"
        assert context.gaps[0].priority == "HIGH"


def test_build_context_rejects_incomplete_results():
    db = Mock()
    db.get.return_value = build_evaluation()

    results = build_results()
    results["global_maturity_level"] = None

    with (
        patch(
            "app.services.ai_explanation_context_service."
            "EvaluationService"
        ) as evaluation_service,
        patch(
            "app.services.ai_explanation_context_service."
            "ImprovementActionService"
        ) as improvement_service,
    ):
        evaluation_service.return_value.get_results_by_id.return_value = (
            results
        )

        with pytest.raises(HTTPException) as exc:
            AIExplanationContextService(db).build_context(10, 5)

        assert exc.value.status_code == 409
        improvement_service.return_value.list_actions.assert_not_called()


def test_build_context_rejects_unauthorized_evaluation():
    db = Mock()

    with (
        patch(
            "app.services.ai_explanation_context_service."
            "EvaluationService"
        ) as evaluation_service,
        patch(
            "app.services.ai_explanation_context_service."
            "ImprovementActionService"
        ) as improvement_service,
    ):
        evaluation_service.return_value.get_results_by_id.side_effect = (
            HTTPException(status_code=404, detail="Evaluation not found")
        )

        with pytest.raises(HTTPException) as exc:
            AIExplanationContextService(db).build_context(10, 5)

        assert exc.value.status_code == 404
        db.get.assert_not_called()
        improvement_service.return_value.list_actions.assert_not_called()
