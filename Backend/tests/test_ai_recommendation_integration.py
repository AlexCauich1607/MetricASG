
import json
from unittest.mock import Mock, patch

from sqlalchemy import select

from app.core.config import settings
from app.main import app
from app.models.ai_recommendation_model import (
    AIRecommendation,
    AIRecommendationStatus,
)
from app.models.ai_recommendation_request import (
    AIRecommendationRequest,
)
from app.models.improvement_action_model import ImprovementAction
from app.services.ai_recommendation_context_service import (
    AIRecommendationContextService,
)
from app.services.evaluations_service import EvaluationService
from app.services.token_service import get_current_user
from tests.test_evaluation import (
    build_responses,
    create_evaluation_data,
)

from datetime import date

from app.models.improvement_action_request import (
    ImprovementActionCreate,
)
from app.services.improvement_action_service import (
    ImprovementActionService,
)


def test_ai_recommendations_use_official_results_and_persist(
    client,
    db_session,
    monkeypatch,
):
    monkeypatch.setattr(settings, "ai_enabled", True)

    data = create_evaluation_data(db_session)

    submitted = EvaluationService(db_session).submit_evaluation(
        {"responses": build_responses(data)},
        data["user"].id,
    )

    evaluation_id = submitted["evaluation_id"]

    # Registrar una brecha oficial mediante una acción de mejora.
    # Se utiliza un indicador respondido en esta evaluación.
    improvement_action = ImprovementActionService(
        db_session
    ).create_action(
        evaluation_id=evaluation_id,
        user_id=data["user"].id,
        payload=ImprovementActionCreate(
            indicator_id=data["indicators"][0].id,
            gap_description=(
                "Falta seguimiento periódico "
                "de indicadores ambientales"
            ),
            description=(
                "Establecer un proceso de seguimiento "
                "de indicadores ambientales"
            ),
            priority="HIGH",
            responsible="Coordinador ASG",
            target_date=date(2026, 12, 15),
        ),
    )

    assert improvement_action.id is not None

    official_results = EvaluationService(
        db_session
    ).get_results_by_id(
        evaluation_id=evaluation_id,
        user_id=data["user"].id,
    )

    context = AIRecommendationContextService(
        db_session
    ).build_context(
        evaluation_id=evaluation_id,
        user_id=data["user"].id,
    )

    assert context.gaps, (
        "La evaluación de prueba debe contener al menos una brecha"
    )

    gap = context.gaps[0]

    provider = Mock()
    provider.generate.return_value = json.dumps(
        {
            "recommendations": [
                {
                    "indicator_id": gap.indicator_id,
                    "gap_description": gap.description,
                    "title": "Mejorar seguimiento ASG",
                    "description": (
                        "Implementar controles periódicos "
                        "para atender la brecha identificada"
                    ),
                    "justification": (
                        "La propuesta atiende una brecha "
                        "de la evaluación oficial"
                    ),
                    "priority": gap.priority,
                }
            ]
        }
    )

    app.dependency_overrides[get_current_user] = (
        lambda: data["user"]
    )

    try:
        with patch(
            "app.controllers.evaluation_controller."
            "create_llm_provider",
            return_value=provider,
        ):
            response = client.post(
                f"/api/evaluations/{evaluation_id}/ai-recommendations"
            )

        assert response.status_code == 200, response.text

        body = response.json()

        assert body["evaluation_id"] == evaluation_id
        assert body["generated_by_ai"] is True
        assert body["requires_human_approval"] is True
        assert len(body["recommendations"]) == 1

        provider.generate.assert_called_once()

        sent_context = AIRecommendationRequest.model_validate_json(
            provider.generate.call_args.kwargs["user_prompt"]
        )

        assert sent_context.evaluation.id == evaluation_id

        assert sent_context.global_result.score == (
            official_results["global_score"]
        )

        assert sent_context.global_result.maturity_level == (
            official_results["global_maturity_level"]
        )

        assert sent_context.evaluation.methodology.version == (
            data["methodology"].version
        )

        db_session.expire_all()

        recommendations = db_session.execute(
            select(AIRecommendation).where(
                AIRecommendation.evaluation_id == evaluation_id
            )
        ).scalars().all()

        assert len(recommendations) == 1

        saved = recommendations[0]

        assert saved.status == AIRecommendationStatus.PENDING
        assert saved.indicator_id == gap.indicator_id
        assert saved.gap_description == gap.description
        assert saved.improvement_action_id is None

        assert body["recommendations"][0]["id"] == saved.id
        assert body["recommendations"][0]["status"] == "PENDING"

        actions = db_session.execute(
            select(ImprovementAction).where(
                ImprovementAction.evaluation_id == evaluation_id
            )
        ).scalars().all()

        assert len(actions) == 1

        assert actions[0].id == improvement_action.id

        updated_results = EvaluationService(
            db_session
        ).get_results_by_id(
            evaluation_id=evaluation_id,
            user_id=data["user"].id,
        )

        assert updated_results == official_results

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )
