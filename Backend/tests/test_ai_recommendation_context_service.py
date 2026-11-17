
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException

from app.services.ai_recommendation_context_service import (
    AIRecommendationContextService,
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
        methodology_id=2,
        date=datetime(2026, 11, 16, tzinfo=timezone.utc),
        methodology=SimpleNamespace(
            id=2,
            name="Metodología ASG",
            version="1.0",
        ),
    )


def build_action(indicator_id=None):
    return SimpleNamespace(
        id=20,
        indicator_id=indicator_id,
        gap_description="Brecha registrada",
        description="Implementar seguimiento mensual",
        priority=SimpleNamespace(value="HIGH"),
        status=SimpleNamespace(value="IN_PROGRESS"),
        target_date=date(2026, 12, 15),
    )


@pytest.fixture
def mocked_services():
    with (
        patch(
            "app.services.ai_recommendation_context_service."
            "EvaluationService"
        ) as evaluation_service,
        patch(
            "app.services.ai_recommendation_context_service."
            "ImprovementActionService"
        ) as improvement_service,
    ):
        evaluation_service.return_value.get_results_by_id.return_value = (
            build_results()
        )
        improvement_service.return_value.list_actions.return_value = []

        yield evaluation_service, improvement_service


def test_build_context_preserves_official_results(mocked_services):
    db = Mock()
    db.get.return_value = build_evaluation()

    evaluation_service, improvement_service = mocked_services

    context = AIRecommendationContextService(db).build_context(
        evaluation_id=10,
        user_id=5,
    )

    assert context.evaluation.id == 10
    assert context.evaluation.methodology.version == "1.0"
    assert context.global_result.score == 7.8
    assert context.ambits[0].score == 7.2
    assert context.gaps == []
    assert context.existing_actions == []

    evaluation_service.return_value.get_results_by_id.assert_called_once_with(
        evaluation_id=10,
        user_id=5,
    )
    improvement_service.return_value.list_actions.assert_called_once_with(
        evaluation_id=10,
        user_id=5,
    )


def test_build_context_maps_action_without_indicator(mocked_services):
    db = Mock()
    db.get.return_value = build_evaluation()

    _, improvement_service = mocked_services
    improvement_service.return_value.list_actions.return_value = [
        build_action()
    ]

    context = AIRecommendationContextService(db).build_context(10, 5)

    assert len(context.gaps) == 1
    assert context.gaps[0].indicator_id is None
    assert context.gaps[0].description == "Brecha registrada"
    assert context.gaps[0].priority == "HIGH"

    assert len(context.existing_actions) == 1
    assert context.existing_actions[0].id == 20
    assert context.existing_actions[0].status == "IN_PROGRESS"
    assert context.existing_actions[0].target_date == date(2026, 12, 15)


def test_build_context_rejects_incomplete_results(mocked_services):
    db = Mock()
    db.get.return_value = build_evaluation()

    evaluation_service, improvement_service = mocked_services

    results = build_results()
    results["global_maturity_level"] = None

    evaluation_service.return_value.get_results_by_id.return_value = (
        results
    )

    with pytest.raises(HTTPException) as exc:
        AIRecommendationContextService(db).build_context(10, 5)

    assert exc.value.status_code == 409
    improvement_service.return_value.list_actions.assert_not_called()


def test_build_context_rejects_unauthorized_evaluation(mocked_services):
    db = Mock()

    evaluation_service, improvement_service = mocked_services

    evaluation_service.return_value.get_results_by_id.side_effect = (
        HTTPException(status_code=404, detail="Evaluation not found")
    )

    with pytest.raises(HTTPException) as exc:
        AIRecommendationContextService(db).build_context(10, 5)

    assert exc.value.status_code == 404
    db.get.assert_not_called()
    improvement_service.return_value.list_actions.assert_not_called()



def configure_indicator_queries(
    db,
    *,
    indicator_id=15,
    answer_indicator_id=15,
    answer_maturity_id=3,
    include_indicator=True,
    include_answer=True,
):
    """Configura las consultas metodológicas simuladas."""

    indicator = SimpleNamespace(
        id=indicator_id,
        question="¿Se mide el consumo energético?",
    )

    response = SimpleNamespace(
        indicator_id=15,
        indicator_answer_id=30,
        maturity_level_id=3,
    )

    answer = SimpleNamespace(
        id=30,
        indicator_id=answer_indicator_id,
        maturity_level_id=answer_maturity_id,
        text="Medición parcial",
    )

    maturity = SimpleNamespace(
        id=3,
        name="Nivel intermedio",
    )

    # La primera consulta utiliza join().filter().all().
    indicator_query = Mock()
    indicator_query.join.return_value.filter.return_value.all.return_value = (
        [indicator] if include_indicator else []
    )

    # Las tres consultas restantes utilizan filter().all().
    response_query = Mock()
    response_query.filter.return_value.all.return_value = [response]

    answer_query = Mock()
    answer_query.filter.return_value.all.return_value = (
        [answer] if include_answer else []
    )

    maturity_query = Mock()
    maturity_query.filter.return_value.all.return_value = [maturity]

    db.query.side_effect = [
        indicator_query,
        response_query,
        answer_query,
        maturity_query,
    ]

def test_build_context_maps_valid_indicator(
    mocked_services,
):
    db = Mock()
    db.get.return_value = build_evaluation()

    _, improvement_service = mocked_services
    improvement_service.return_value.list_actions.return_value = [
        build_action(indicator_id=15)
    ]

    configure_indicator_queries(db)

    context = AIRecommendationContextService(db).build_context(
        evaluation_id=10,
        user_id=5,
    )

    assert len(context.gaps) == 1
    assert context.gaps[0].indicator_id == 15
    assert context.gaps[0].indicator_question == (
        "¿Se mide el consumo energético?"
    )
    assert context.gaps[0].indicator_answer == "Medición parcial"
    assert context.gaps[0].maturity_level == "Nivel intermedio"

    assert context.existing_actions[0].indicator_id == 15


def test_build_context_rejects_answer_from_another_indicator(
    mocked_services,
):
    db = Mock()
    db.get.return_value = build_evaluation()

    _, improvement_service = mocked_services
    improvement_service.return_value.list_actions.return_value = [
        build_action(indicator_id=15)
    ]

    configure_indicator_queries(
        db,
        answer_indicator_id=99,
    )

    with pytest.raises(HTTPException) as exc:
        AIRecommendationContextService(db).build_context(10, 5)

    assert exc.value.status_code == 409


def test_build_context_rejects_mismatched_maturity_level(
    mocked_services,
):
    db = Mock()
    db.get.return_value = build_evaluation()

    _, improvement_service = mocked_services
    improvement_service.return_value.list_actions.return_value = [
        build_action(indicator_id=15)
    ]

    configure_indicator_queries(
        db,
        answer_maturity_id=99,
    )

    with pytest.raises(HTTPException) as exc:
        AIRecommendationContextService(db).build_context(10, 5)

    assert exc.value.status_code == 409


def test_build_context_rejects_indicator_outside_methodology(
    mocked_services,
):
    db = Mock()
    db.get.return_value = build_evaluation()

    _, improvement_service = mocked_services
    improvement_service.return_value.list_actions.return_value = [
        build_action(indicator_id=15)
    ]

    configure_indicator_queries(
        db,
        include_indicator=False,
    )

    with pytest.raises(HTTPException) as exc:
        AIRecommendationContextService(db).build_context(10, 5)

    assert exc.value.status_code == 409

def test_build_context_rejects_missing_selected_answer(
    mocked_services,
):
    db = Mock()
    db.get.return_value = build_evaluation()

    _, improvement_service = mocked_services
    improvement_service.return_value.list_actions.return_value = [
        build_action(indicator_id=15)
    ]

    configure_indicator_queries(
        db,
        include_answer=False,
    )

    with pytest.raises(HTTPException) as exc:
        AIRecommendationContextService(db).build_context(10, 5)

    assert exc.value.status_code == 409


def test_build_context_includes_optional_constraints(mocked_services):
    from app.models.ai_recommendation_request import (
        AIRecommendationConstraints,
    )

    db = Mock()
    db.get.return_value = build_evaluation()

    constraints = AIRecommendationConstraints(
        budget="Presupuesto limitado",
        resources="Equipo interno",
        additional_context="Priorizar acciones de bajo costo",
    )

    context = AIRecommendationContextService(db).build_context(
        evaluation_id=10,
        user_id=5,
        constraints=constraints,
    )

    assert context.constraints.budget == "Presupuesto limitado"
    assert context.constraints.resources == "Equipo interno"
    assert (
        context.constraints.additional_context
        == "Priorizar acciones de bajo costo"
    )

    assert context.global_result.score == 7.8
    assert context.ambits[0].score == 7.2
