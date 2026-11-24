import json
from datetime import date
from uuid import uuid4
from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.main import app
from app.core.config import settings
from app.core.roles import CompanyRole

from app.models.company_model import Company
from app.models.company_membership_model import (
    CompanyMembershipStatus,
)
from app.models.evaluation_model import EvaluationStatus
from app.models.evaluation_evidence_model import (
    EvaluationEvidence,
    EvidenceType,
)
from app.models.improvement_action_model import ImprovementAction
from app.models.improvement_action_request import ImprovementActionCreate
from app.models.audit_log_model import AuditLog
from app.models.ai_recommendation_model import (
    AIRecommendation,
    AIRecommendationStatus,
)
from app.models.ai_recommendation_acceptance_request import (
    AIRecommendationAcceptanceRequest,
)

from app.services.token_service import get_current_user
from app.services.evaluations_service import EvaluationService
from app.services.improvement_action_service import (
    ImprovementActionService,
)
from app.services.evidence_storage_service import EvidenceStorageService
from app.services.ai_recommendation_context_service import (
    AIRecommendationContextService,
)
from app.services.ai_recommendation_persistence_service import (
    AIRecommendationPersistenceService,
)
from app.services.ai_recommendation_review_service import (
    AIRecommendationReviewService,
)
from app.controllers.evidence_controller import (
    get_evidence_storage_service,
)

from tests.test_evaluation import (
    create_evaluation_data,
    build_responses,
)
from tests.test_evaluation_company_access import create_member
from tests.test_evaluation_evidence import create_evidence_data
from tests.test_evidence_storage_service import create_valid_pdf

from tests.test_benchmark_service import benchmark_data
from tests.test_benchmark_controller import (
    benchmark_http_data,
    benchmark_params,
)
from tests.test_ai_recommendation_review_service import (
    prepare_recommendation,
)
from tests.test_ai_recommendation_persistence_service import (
    build_context,
    build_response,
    prepare_evaluation,
)


ALL_ROLES = list(CompanyRole)

WRITE_ROLES = (
    CompanyRole.COMPANY_ADMIN,
    CompanyRole.ASG_MANAGER,
)

PROVIDER_PATH = (
    "app.controllers.evaluation_controller.create_llm_provider"
)


def authenticate(user):
    app.dependency_overrides[get_current_user] = lambda: user


def create_outsider(db_session):
    company = Company(
        name=f"External Company {uuid4().hex}",
        active=True,
    )

    db_session.add(company)
    db_session.flush()

    user, _ = create_member(
        db_session,
        company.id,
        CompanyRole.COMPANY_ADMIN,
    )

    return user


def improvement_payload():
    return {
        "gap_description": "Falta seguimiento energético",
        "description": "Registrar consumos mensuales",
        "priority": "HIGH",
        "responsible": "Coordinador ASG",
        "target_date": "2026-12-15",
    }


def assert_audit_actor(
    db_session,
    action,
    resource_id,
    actor_id,
    company_id,
):
    events = db_session.execute(
        select(AuditLog).where(
            AuditLog.action == action,
            AuditLog.resource_id == resource_id,
        )
    ).scalars().all()

    assert len(events) == 1
    assert events[0].actor_id == actor_id
    assert events[0].company_id == company_id

@pytest.mark.parametrize("role", ALL_ROLES)
def test_benchmark_allows_non_author_members(
    client,
    db_session,
    benchmark_http_data,
    role,
):
    data = benchmark_http_data

    member, _ = create_member(
        db_session,
        data["company"].id,
        role,
    )

    authenticate(data["user"])

    original = client.get(
        "/api/benchmark",
        params=benchmark_params(data),
    )

    assert original.status_code == 200

    authenticate(member)

    response = client.get(
        "/api/benchmark",
        params=benchmark_params(data),
    )

    assert response.status_code == 200, response.text
    assert response.json() == original.json()
    assert response.json()["available"] is True
    assert response.json()["global_average"] == pytest.approx(8.0)


def test_benchmark_denies_foreign_company_member(
    client,
    db_session,
    benchmark_http_data,
):
    data = benchmark_http_data
    outsider = create_outsider(db_session)

    authenticate(outsider)

    response = client.get(
        "/api/benchmark",
        params=benchmark_params(data),
    )

    assert response.status_code == 403

@pytest.fixture
def shared_improvement_data(db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    evaluation.status = EvaluationStatus.COMPLETED

    db_session.flush()

    action = ImprovementActionService(db_session).create_action(
        evaluation_id=evaluation.id,
        user_id=data["user"].id,
        payload=ImprovementActionCreate(
            **improvement_payload()
        ),
    )

    return {
        **data,
        "action_id": action.id,
    }


@pytest.mark.parametrize("role", ALL_ROLES)
def test_non_author_improvement_permissions(
    client,
    db_session,
    shared_improvement_data,
    role,
):
    data = shared_improvement_data
    evaluation = data["evaluation"]

    member, _ = create_member(
        db_session,
        evaluation.company_id,
        role,
    )

    member_id = member.id
    company_id = evaluation.company_id
    action_id = data["action_id"]

    db_session.commit()

    authenticate(member)

    base = (
        f"/api/evaluations/{evaluation.id}"
        "/improvement-actions"
    )

    # Todos los roles pueden consultar.
    response = client.get(base)
    assert response.status_code == 200
    assert response.json()[0]["id"] == action_id

    response = client.get(f"{base}/{action_id}")
    assert response.status_code == 200

    response = client.get(f"{base}/progress")
    assert response.status_code == 200
    assert response.json()["total"] == 1

    # Creación por rol.
    response = client.post(
        base,
        json=improvement_payload(),
    )

    if role in WRITE_ROLES:
        assert response.status_code == 201, response.text

        assert_audit_actor(
            db_session,
            "improvement_action.created",
            response.json()["id"],
            member_id,
            company_id,
        )
    else:
        assert response.status_code == 403

        assert db_session.query(ImprovementAction).filter(
            ImprovementAction.evaluation_id == evaluation.id
        ).count() == 1

    # Actualización por rol.
    response = client.patch(
        f"{base}/{action_id}",
        json={"description": "Registrar consumos semanales"},
    )

    if role in WRITE_ROLES:
        assert response.status_code == 200, response.text

        assert_audit_actor(
            db_session,
            "improvement_action.updated",
            action_id,
            member_id,
            company_id,
        )
    else:
        assert response.status_code == 403

    db_session.expire_all()

    stored = db_session.get(ImprovementAction, action_id)

    assert stored.description == (
        "Registrar consumos semanales"
        if role in WRITE_ROLES
        else "Registrar consumos mensuales"
    )

    # Eliminación exclusiva de administradores.
    response = client.delete(f"{base}/{action_id}")

    db_session.expire_all()

    if role == CompanyRole.COMPANY_ADMIN:
        assert response.status_code == 204
        assert db_session.get(
            ImprovementAction, action_id
        ) is None

        assert_audit_actor(
            db_session,
            "improvement_action.deleted",
            action_id,
            member_id,
            company_id,
        )
    else:
        assert response.status_code == 403
        assert db_session.get(
            ImprovementAction, action_id
        ) is not None

def test_foreign_member_cannot_manage_improvements(
    client,
    db_session,
    shared_improvement_data,
):
    data = shared_improvement_data
    outsider = create_outsider(db_session)

    db_session.commit()

    authenticate(outsider)

    base = (
        f"/api/evaluations/{data['evaluation'].id}"
        "/improvement-actions"
    )

    detail = f"{base}/{data['action_id']}"

    responses = [
        client.get(base),
        client.get(detail),
        client.get(f"{base}/progress"),
        client.post(base, json=improvement_payload()),
        client.patch(
            detail,
            json={"description": "Unauthorized change"},
        ),
        client.delete(detail),
    ]

    assert all(
        response.status_code == 404
        for response in responses
    )

    db_session.expire_all()

    action = db_session.get(
        ImprovementAction,
        data["action_id"],
    )

    assert action is not None
    assert action.description == "Registrar consumos mensuales"


@pytest.mark.parametrize(
    "restriction",
    ["membership", "company"],
)
def test_shared_improvement_access_is_revoked(
    client,
    db_session,
    shared_improvement_data,
    restriction,
):
    data = shared_improvement_data

    member, membership = create_member(
        db_session,
        data["company"].id,
        CompanyRole.COMPANY_ADMIN,
    )

    authenticate(member)

    base = (
        f"/api/evaluations/{data['evaluation'].id}"
        "/improvement-actions"
    )

    assert client.get(base).status_code == 200

    if restriction == "membership":
        membership.status = CompanyMembershipStatus.INACTIVE
    else:
        data["company"].active = False

    db_session.commit()

    assert client.get(base).status_code == 404

    assert client.get(
        f"{base}/{data['action_id']}"
    ).status_code == 404

    assert client.get(
        f"{base}/progress"
    ).status_code == 404

    assert client.post(
        base,
        json=improvement_payload(),
    ).status_code == 404


@pytest.mark.parametrize(
    "role",
    [
        CompanyRole.COMPANY_ADMIN,
        CompanyRole.ASG_MANAGER,
    ],
)
def test_non_author_cannot_manage_draft_improvements(
    client,
    db_session,
    role,
):
    data = create_evidence_data(db_session)

    member, _ = create_member(
        db_session,
        data["company"].id,
        role,
    )

    db_session.commit()

    authenticate(member)

    base = (
        f"/api/evaluations/{data['evaluation'].id}"
        "/improvement-actions"
    )

    assert client.get(base).status_code == 409

    response = client.post(
        base,
        json=improvement_payload(),
    )

    assert response.status_code == 409

    assert db_session.query(ImprovementAction).filter(
        ImprovementAction.evaluation_id == data["evaluation"].id
    ).count() == 0

@pytest.fixture
def shared_file_data(db_session, tmp_path):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    indicator = data["indicators"][0]

    storage = EvidenceStorageService(
        storage_path=tmp_path,
    )

    content = create_valid_pdf()

    storage_key = storage.save_file(
        "evidencia.pdf",
        content,
        "application/pdf",
    )

    evidence = EvaluationEvidence(
        evaluation_id=evaluation.id,
        indicator_id=indicator.id,
        user_id=data["user"].id,
        type=EvidenceType.FILE,
        content=None,
        storage_key=storage_key,
        original_filename="evidencia.pdf",
        mime_type="application/pdf",
        file_size=len(content),
    )

    db_session.add(evidence)

    evaluation.status = EvaluationStatus.COMPLETED

    db_session.commit()

    app.dependency_overrides[
        get_evidence_storage_service
    ] = lambda: storage

    try:
        yield {
            **data,
            "evidence_id": evidence.id,
            "storage": storage,
            "storage_key": storage_key,
            "content": content,
        }
    finally:
        app.dependency_overrides.pop(
            get_evidence_storage_service,
            None,
        )


def evidence_base(data):
    return (
        f"/api/evaluations/{data['evaluation'].id}"
        "/evidences"
    )


def assert_evidence_preserved(db_session, data):
    db_session.expire_all()

    evidence = db_session.get(
        EvaluationEvidence,
        data["evidence_id"],
    )

    assert evidence is not None

    assert data["storage"].get_file(
        data["storage_key"]
    ).read_bytes() == data["content"]

@pytest.mark.parametrize("role", ALL_ROLES)
def test_non_author_can_read_completed_evidences(
    client,
    db_session,
    shared_file_data,
    role,
):
    data = shared_file_data

    member, _ = create_member(
        db_session,
        data["company"].id,
        role,
    )

    db_session.commit()

    authenticate(member)

    base = evidence_base(data)
    detail = f"{base}/{data['evidence_id']}"

    response = client.get(base)

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == data["evidence_id"]
    assert "storage_key" not in response.json()[0]
    assert "user_id" not in response.json()[0]

    response = client.get(detail)

    assert response.status_code == 200
    assert response.json()["original_filename"] == "evidencia.pdf"

    response = client.get(f"{detail}/download")

    assert response.status_code == 200
    assert response.content == data["content"]

    # Ningún miembro no autor puede modificar las evidencias.
    response = client.post(
        base,
        json={
            "indicator_id": data["indicators"][0].id,
            "type": "COMMENT",
            "content": "Unauthorized modification",
        },
    )

    assert response.status_code == 404

    response = client.post(
        f"{base}/upload",
        data={
            "indicator_id": str(data["indicators"][0].id),
        },
        files={
            "file": (
                "new.pdf",
                data["content"],
                "application/pdf",
            ),
        },
    )

    assert response.status_code == 404
    assert client.delete(detail).status_code == 404

    assert_evidence_preserved(db_session, data)

def test_same_company_member_cannot_read_foreign_draft(
    client,
    db_session,
    shared_file_data,
):
    data = shared_file_data

    data["evaluation"].status = EvaluationStatus.DRAFT

    member, _ = create_member(
        db_session,
        data["company"].id,
        CompanyRole.COMPANY_ADMIN,
    )

    db_session.commit()

    authenticate(member)

    base = evidence_base(data)
    detail = f"{base}/{data['evidence_id']}"

    assert client.get(base).status_code == 404
    assert client.get(detail).status_code == 404
    assert client.get(f"{detail}/download").status_code == 404
    assert client.delete(detail).status_code == 404

    assert_evidence_preserved(db_session, data)


@pytest.mark.parametrize(
    "restriction",
    ["membership", "company"],
)
def test_completed_evidence_access_is_revoked(
    client,
    db_session,
    shared_file_data,
    restriction,
):
    data = shared_file_data

    member, membership = create_member(
        db_session,
        data["company"].id,
        CompanyRole.AUDITOR,
    )

    authenticate(member)

    base = evidence_base(data)
    detail = f"{base}/{data['evidence_id']}"

    assert client.get(
        f"{detail}/download"
    ).status_code == 200

    if restriction == "membership":
        membership.status = CompanyMembershipStatus.INACTIVE
    else:
        data["company"].active = False

    db_session.commit()

    assert client.get(base).status_code == 404
    assert client.get(detail).status_code == 404
    assert client.get(f"{detail}/download").status_code == 404

    assert_evidence_preserved(db_session, data)


def test_foreign_company_cannot_download_evidence(
    client,
    db_session,
    shared_file_data,
):
    data = shared_file_data

    outsider = create_outsider(db_session)

    authenticate(outsider)

    base = evidence_base(data)
    detail = f"{base}/{data['evidence_id']}"

    assert client.get(base).status_code == 404
    assert client.get(detail).status_code == 404
    assert client.get(f"{detail}/download").status_code == 404

    assert_evidence_preserved(db_session, data)


def test_auditor_cannot_access_own_old_draft(
    client,
    db_session,
    shared_file_data,
):
    data = shared_file_data

    data["evaluation"].status = EvaluationStatus.DRAFT
    data["membership"].role = CompanyRole.AUDITOR

    db_session.commit()

    authenticate(data["user"])

    base = evidence_base(data)
    detail = f"{base}/{data['evidence_id']}"

    assert client.get(base).status_code == 403
    assert client.get(f"{detail}/download").status_code == 403
    assert client.delete(detail).status_code == 403

    assert_evidence_preserved(db_session, data)


def test_author_cannot_modify_completed_evidences(
    client,
    db_session,
    shared_file_data,
):
    data = shared_file_data

    authenticate(data["user"])

    base = evidence_base(data)
    detail = f"{base}/{data['evidence_id']}"

    assert client.get(detail).status_code == 200

    response = client.post(
        base,
        json={
            "indicator_id": data["indicators"][0].id,
            "type": "COMMENT",
            "content": "New comment",
        },
    )

    assert response.status_code == 409
    assert client.delete(detail).status_code == 409

    assert_evidence_preserved(db_session, data)

@pytest.fixture
def official_evaluation_data(db_session):
    data = create_evaluation_data(db_session)

    result = EvaluationService(db_session).submit_evaluation(
        {"responses": build_responses(data)},
        data["user"].id,
    )

    return {
        **data,
        "evaluation_id": result["evaluation_id"],
    }


@pytest.mark.parametrize("role", ALL_ROLES)
def test_non_author_can_generate_ai_explanation(
    client,
    db_session,
    monkeypatch,
    official_evaluation_data,
    role,
):
    monkeypatch.setattr(settings, "ai_enabled", True)

    data = official_evaluation_data

    member, _ = create_member(
        db_session,
        data["company"].id,
        role,
    )

    authenticate(member)

    provider = Mock()

    provider.generate.return_value = (
        "Explicación ficticia de resultados empresariales."
    )

    with patch(PROVIDER_PATH, return_value=provider):
        response = client.post(
            f"/api/evaluations/{data['evaluation_id']}"
            "/ai-explanation"
        )

    assert response.status_code == 200, response.text
    assert response.json()["evaluation_id"] == data["evaluation_id"]
    assert response.json()["generated_by_ai"] is True

    provider.generate.assert_called_once()

    context = json.loads(
        provider.generate.call_args.kwargs["user_prompt"]
    )

    assert context["evaluation"]["id"] == data["evaluation_id"]
    assert context["global_result"]["score"] == 8


def test_foreign_member_cannot_generate_ai_explanation(
    client,
    db_session,
    monkeypatch,
    official_evaluation_data,
):
    monkeypatch.setattr(settings, "ai_enabled", True)

    data = official_evaluation_data

    outsider = create_outsider(db_session)

    authenticate(outsider)

    with patch(PROVIDER_PATH) as provider_factory:
        response = client.post(
            f"/api/evaluations/{data['evaluation_id']}"
            "/ai-explanation"
        )

    assert response.status_code == 404
    provider_factory.assert_not_called()

@pytest.mark.parametrize("role", ALL_ROLES)
def test_non_author_ai_recommendation_generation(
    client,
    db_session,
    monkeypatch,
    official_evaluation_data,
    role,
):
    monkeypatch.setattr(settings, "ai_enabled", True)

    data = official_evaluation_data
    evaluation_id = data["evaluation_id"]

    ImprovementActionService(db_session).create_action(
        evaluation_id=evaluation_id,
        user_id=data["user"].id,
        payload=ImprovementActionCreate(
            indicator_id=data["indicators"][0].id,
            **improvement_payload(),
        ),
    )

    context = AIRecommendationContextService(
        db_session
    ).build_context(
        evaluation_id=evaluation_id,
        user_id=data["user"].id,
    )

    gap = context.gaps[0]

    member, _ = create_member(
        db_session,
        data["company"].id,
        role,
    )

    db_session.commit()

    authenticate(member)

    provider = Mock()

    provider.generate.return_value = json.dumps({
        "recommendations": [
            {
                "indicator_id": gap.indicator_id,
                "gap_description": gap.description,
                "title": "Mejorar seguimiento energético",
                "description": "Implementar controles semanales",
                "justification": "Atiende la brecha identificada",
                "priority": gap.priority,
            }
        ]
    })

    with patch(
        PROVIDER_PATH,
        return_value=provider,
    ) as provider_factory:
        response = client.post(
            f"/api/evaluations/{evaluation_id}"
            "/ai-recommendations"
        )

    recommendations = db_session.query(AIRecommendation).filter(
        AIRecommendation.evaluation_id == evaluation_id
    ).all()

    if role in WRITE_ROLES:
        assert response.status_code == 200, response.text
        provider.generate.assert_called_once()

        assert len(recommendations) == 1

        recommendation = recommendations[0]

        assert recommendation.status == AIRecommendationStatus.PENDING
        assert recommendation.improvement_action_id is None

        assert_audit_actor(
            db_session,
            "ai_recommendation.generated",
            recommendation.id,
            member.id,
            data["company"].id,
        )
    else:
        assert response.status_code == 403
        provider_factory.assert_not_called()
        assert recommendations == []

    # Generar recomendaciones no debe crear nuevas acciones.
    assert db_session.query(ImprovementAction).filter(
        ImprovementAction.evaluation_id == evaluation_id
    ).count() == 1

@pytest.mark.parametrize("role", ALL_ROLES)
def test_persistence_enforces_non_author_roles(
    db_session,
    role,
):
    data = prepare_evaluation(db_session)
    evaluation = data["evaluation"]

    member, _ = create_member(
        db_session,
        evaluation.company_id,
        role,
    )

    db_session.commit()

    service = AIRecommendationPersistenceService(db_session)

    arguments = {
        "evaluation_id": evaluation.id,
        "user_id": member.id,
        "context": build_context(evaluation),
        "response": build_response(),
    }

    if role in WRITE_ROLES:
        saved = service.save_recommendations(**arguments)

        assert len(saved) == 1
        assert saved[0].status == AIRecommendationStatus.PENDING

        assert_audit_actor(
            db_session,
            "ai_recommendation.generated",
            saved[0].id,
            member.id,
            evaluation.company_id,
        )
    else:
        with pytest.raises(HTTPException) as exc:
            service.save_recommendations(**arguments)

        assert exc.value.status_code == 403

        assert db_session.query(AIRecommendation).filter(
            AIRecommendation.evaluation_id == evaluation.id
        ).count() == 0

@pytest.mark.parametrize("role", ALL_ROLES)
@pytest.mark.parametrize("decision", ["ACCEPT", "REJECT"])
def test_non_author_can_review_according_to_role(
    db_session,
    role,
    decision,
):
    data, recommendation_id = prepare_recommendation(
        db_session
    )

    evaluation = data["evaluation"]

    member, _ = create_member(
        db_session,
        evaluation.company_id,
        role,
    )

    db_session.commit()

    payload_data = {
        "decision": decision,
        "recommendation_id": recommendation_id,
    }

    if decision == "ACCEPT":
        payload_data.update({
            "responsible": "Coordinador ASG",
            "target_date": date(2026, 12, 15),
        })

    payload = AIRecommendationAcceptanceRequest.model_validate(
        payload_data
    )

    service = AIRecommendationReviewService(db_session)

    if role in WRITE_ROLES:
        result = service.review(
            evaluation_id=evaluation.id,
            user_id=member.id,
            payload=payload,
        )

        assert result.reviewed_by == member.id

        assert result.status == (
            AIRecommendationStatus.ACCEPTED
            if decision == "ACCEPT"
            else AIRecommendationStatus.REJECTED
        )

        assert_audit_actor(
            db_session,
            "ai_recommendation.reviewed",
            recommendation_id,
            member.id,
            evaluation.company_id,
        )

        if decision == "ACCEPT":
            assert result.improvement_action_id is not None

            assert_audit_actor(
                db_session,
                "improvement_action.created",
                result.improvement_action_id,
                member.id,
                evaluation.company_id,
            )
        else:
            assert result.improvement_action_id is None

    else:
        with pytest.raises(HTTPException) as exc:
            service.review(
                evaluation_id=evaluation.id,
                user_id=member.id,
                payload=payload,
            )

        assert exc.value.status_code == 403

        db_session.expire_all()

        recommendation = db_session.get(
            AIRecommendation,
            recommendation_id,
        )

        assert recommendation.status == AIRecommendationStatus.PENDING
        assert recommendation.reviewed_by is None
        assert recommendation.improvement_action_id is None

    expected_actions = (
        1
        if role in WRITE_ROLES and decision == "ACCEPT"
        else 0
    )

    assert db_session.query(ImprovementAction).filter(
        ImprovementAction.evaluation_id == evaluation.id
    ).count() == expected_actions
