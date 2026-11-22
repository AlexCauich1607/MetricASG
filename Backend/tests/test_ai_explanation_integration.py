
from unittest.mock import Mock, patch

from app.main import app
from app.services.evaluations_service import EvaluationService
from app.services.token_service import get_current_user
from tests.test_evaluation import (
    build_responses,
    create_evaluation_data,
)


def test_ai_explanation_uses_official_database_results(
    client,
    db_session,
    monkeypatch,
):
    from app.core.config import settings

    monkeypatch.setattr(settings, "ai_enabled", True)

    data = create_evaluation_data(db_session)

    submitted = EvaluationService(db_session).submit_evaluation(
        {
            "responses": build_responses(data),
        },
        data["user"].id,
    )

    evaluation_id = submitted["evaluation_id"]

    official_results = EvaluationService(db_session).get_results_by_id(
        evaluation_id=evaluation_id,
        user_id=data["user"].id,
    )

    provider = Mock()
    provider.generate.return_value = (
        "Explicación ficticia de los resultados ASG."
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
                f"/api/evaluations/{evaluation_id}/ai-explanation"
            )

        assert response.status_code == 200, response.text

        body = response.json()

        assert body["evaluation_id"] == evaluation_id
        assert body["generated_by_ai"] is True
        assert body["explanation"] == (
            "Explicación ficticia de los resultados ASG."
        )

        provider.generate.assert_called_once()

        sent_request = provider.generate.call_args.kwargs["user_prompt"]

        from app.models.ai_explanation_request import (
            AIExplanationRequest,
        )

        context = AIExplanationRequest.model_validate_json(
            sent_request
        )

        assert context.evaluation.id == evaluation_id
        assert context.evaluation.methodology.version == (
            data["methodology"].version
        )

        assert context.global_result.score == (
            official_results["global_score"]
        )
        assert context.global_result.maturity_level == (
            official_results["global_maturity_level"]
        )

        assert len(context.ambits) == len(
            official_results["ambits"]
        )

        for ambit in context.ambits:
            official_ambit = next(
                item
                for item in official_results["ambits"]
                if item["ambit_id"] == ambit.id
            )

            assert ambit.score == official_ambit["score"]
            assert ambit.maturity_level == (
                official_ambit["maturity_level"]
            )

        updated_results = EvaluationService(db_session).get_results_by_id(
            evaluation_id=evaluation_id,
            user_id=data["user"].id,
        )

        assert updated_results == official_results

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_ai_explanation_rejects_other_user_with_real_database(
    client,
    db_session,
    monkeypatch,
):
    from app.core.config import settings
    from app.models.user_model import User
    from app.services.evaluations_service import EvaluationService

    monkeypatch.setattr(settings, "ai_enabled", True)

    data = create_evaluation_data(db_session)

    submitted = EvaluationService(db_session).submit_evaluation(
        {
            "responses": build_responses(data),
        },
        data["user"].id,
    )

    evaluation_id = submitted["evaluation_id"]

    other_user = User(
        name="Other",
        lastname="User",
        email="other-ai-user@test.local",
        password="test-password",
        active=True,
    )

    db_session.add(other_user)
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: other_user

    try:
        with patch(
            "app.controllers.evaluation_controller.create_llm_provider"
        ) as provider_factory:
            response = client.post(
                f"/api/evaluations/{evaluation_id}/ai-explanation"
            )

        assert response.status_code == 404
        provider_factory.assert_not_called()

    finally:
        app.dependency_overrides.pop(get_current_user, None)
