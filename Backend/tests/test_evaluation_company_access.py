from uuid import uuid4
from datetime import datetime

import pytest
from fastapi import HTTPException

from app.main import app
from app.core.roles import UserRole, CompanyRole
from app.models.user_model import User
from app.models.company_model import Company
from app.models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)
from app.models.evaluation_model import (
    Evaluation,
    EvaluationStatus,
)
from app.services.evaluations_service import EvaluationService
from app.services.token_service import get_current_user

from tests.test_evaluation import (
    create_evaluation_data,
    build_responses,
)


def create_member(
    db_session,
    company_id,
    role=CompanyRole.ASG_MANAGER,
    status=CompanyMembershipStatus.ACTIVE,
):
    user = User(
        name="Company",
        lastname="Member",
        position="Tester",
        email=f"member-{uuid4().hex}@test.local",
        phone="9999999998",
        password="test-password",
        role=UserRole.USER,
        active=True,
    )

    db_session.add(user)
    db_session.flush()

    membership = CompanyMembership(
        user_id=user.id,
        company_id=company_id,
        role=role,
        status=status,
    )

    db_session.add(membership)
    db_session.flush()

    return user, membership

@pytest.fixture
def shared_evaluation_data(db_session):
    data = create_evaluation_data(db_session)

    service = EvaluationService(db_session)
    company = data["company"]

    second_author, _ = create_member(
        db_session,
        company.id,
        CompanyRole.ASG_MANAGER,
    )

    payload = {
        "company_id": company.id,
        "responses": build_responses(data),
    }

    first = service.submit_evaluation(
        payload,
        data["user"].id,
    )

    # Simular la llegada del siguiente ciclo empresarial.
    company.biannual_evaluation = False
    company.next_evaluation = None
    db_session.flush()

    second = service.submit_evaluation(
        payload,
        second_author.id,
    )

    first_evaluation = db_session.get(
        Evaluation,
        first["evaluation_id"],
    )

    second_evaluation = db_session.get(
        Evaluation,
        second["evaluation_id"],
    )

    first_evaluation.date = datetime(2026, 1, 15)
    second_evaluation.date = datetime(2026, 7, 15)

    db_session.flush()

    return {
        **data,
        "first_author": data["user"],
        "second_author": second_author,
        "first": first_evaluation,
        "second": second_evaluation,
    }

@pytest.mark.parametrize(
    "role",
    [
        CompanyRole.COMPANY_ADMIN,
        CompanyRole.ASG_MANAGER,
        CompanyRole.COLLABORATOR,
        CompanyRole.AUDITOR,
    ],
)
def test_company_members_can_read_shared_evaluations(
    db_session,
    shared_evaluation_data,
    role,
):
    data = shared_evaluation_data
    company_id = data["company"].id

    reader, _ = create_member(
        db_session,
        company_id,
        role,
    )

    service = EvaluationService(db_session)

    first_id = data["first"].id
    second_id = data["second"].id

    # El lector no es autor de ninguna evaluación.
    assert reader.id != data["first"].user_id
    assert reader.id != data["second"].user_id

    # Últimos resultados.
    latest = service.get_latest_results(
        user_id=reader.id,
        company_id=company_id,
    )

    assert latest["evaluation_id"] == second_id
    assert latest["global_score"] == 8

    # Resultados individuales.
    for evaluation_id in (first_id, second_id):
        result = service.get_results_by_id(
            evaluation_id=evaluation_id,
            user_id=reader.id,
        )

        assert result["evaluation_id"] == evaluation_id
        assert result["global_score"] == 8
        assert len(result["ambits"]) == 3

    # Historial empresarial.
    history = service.get_evaluation_history(
        user_id=reader.id,
        company_id=company_id,
    )

    assert [
        item["evaluation_id"]
        for item in history["history"]
    ] == [first_id, second_id]

    assert history["averages"]["global_score"] == 8

    # Comparación entre distintos autores.
    comparison = service.get_comparison(
        evaluation_id_1=first_id,
        evaluation_id_2=second_id,
        user_id=reader.id,
        company_id=company_id,
    )

    assert comparison["comparable"] is True

    assert [
        item["evaluation_id"]
        for item in comparison["evaluations"]
    ] == [first_id, second_id]

    assert comparison["differences"]["global_score"] == 0

    # Dashboard histórico.
    dashboard = service.get_historical_dashboard(
        user_id=reader.id,
        company_id=company_id,
    )

    assert [
        item["evaluation_id"]
        for item in dashboard["history"]
    ] == [first_id, second_id]

    assert dashboard["history"][0]["global_delta"] is None
    assert dashboard["history"][1]["global_delta"] == 0

def test_authors_receive_same_company_results(
    db_session,
    shared_evaluation_data,
):
    data = shared_evaluation_data
    service = EvaluationService(db_session)

    company_id = data["company"].id

    first_author_result = service.get_latest_results(
        user_id=data["first_author"].id,
        company_id=company_id,
    )

    second_author_result = service.get_latest_results(
        user_id=data["second_author"].id,
        company_id=company_id,
    )

    assert first_author_result == second_author_result

    assert first_author_result["evaluation_id"] == (
        data["second"].id
    )

def test_other_company_member_cannot_access_evaluations(
    db_session,
    shared_evaluation_data,
):
    data = shared_evaluation_data
    service = EvaluationService(db_session)

    other_company = Company(
        name=f"Other Company {uuid4().hex}",
        active=True,
    )

    db_session.add(other_company)
    db_session.flush()

    outsider, _ = create_member(
        db_session,
        other_company.id,
        CompanyRole.COMPANY_ADMIN,
    )

    company_id = data["company"].id

    operations = [
        lambda: service.get_latest_results(
            outsider.id,
            company_id,
        ),
        lambda: service.get_evaluation_history(
            outsider.id,
            company_id,
        ),
        lambda: service.get_historical_dashboard(
            outsider.id,
            company_id,
        ),
        lambda: service.get_comparison(
            data["first"].id,
            data["second"].id,
            outsider.id,
            company_id,
        ),
    ]

    for operation in operations:
        with pytest.raises(HTTPException) as exc:
            operation()

        assert exc.value.status_code == 403

    # El acceso directo por identificador tampoco debe funcionar.
    with pytest.raises(HTTPException) as exc:
        service.get_results_by_id(
            data["second"].id,
            outsider.id,
        )

    assert exc.value.status_code == 404

@pytest.mark.parametrize(
    "restriction",
    ["inactive_membership", "inactive_company"],
)
def test_revoked_company_access(
    db_session,
    shared_evaluation_data,
    restriction,
):
    data = shared_evaluation_data
    company = data["company"]

    reader, membership = create_member(
        db_session,
        company.id,
        CompanyRole.AUDITOR,
    )

    service = EvaluationService(db_session)

    # Comprobar acceso inicial.
    assert service.get_latest_results(
        reader.id,
        company.id,
    )["evaluation_id"] == data["second"].id

    if restriction == "inactive_membership":
        membership.status = CompanyMembershipStatus.INACTIVE
    else:
        company.active = False

    db_session.flush()

    operations = [
        lambda: service.get_latest_results(
            reader.id,
            company.id,
        ),
        lambda: service.get_evaluation_history(
            reader.id,
            company.id,
        ),
        lambda: service.get_historical_dashboard(
            reader.id,
            company.id,
        ),
        lambda: service.get_comparison(
            data["first"].id,
            data["second"].id,
            reader.id,
            company.id,
        ),
    ]

    for operation in operations:
        with pytest.raises(HTTPException) as exc:
            operation()

        assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as exc:
        service.get_results_by_id(
            data["second"].id,
            reader.id,
        )

    assert exc.value.status_code == 404

    # Revocar acceso no debe eliminar datos históricos.
    assert db_session.get(
        Evaluation,
        data["second"].id,
    ) is not None

def test_shared_results_do_not_expose_drafts(
    db_session,
    shared_evaluation_data,
):
    data = shared_evaluation_data
    company = data["company"]

    reader, _ = create_member(
        db_session,
        company.id,
        CompanyRole.COLLABORATOR,
    )

    service = EvaluationService(db_session)

    company.biannual_evaluation = False
    company.next_evaluation = None
    db_session.flush()

    draft = service.save_draft(
        {
            "company_id": company.id,
            "responses": build_responses(data)[:1],
        },
        data["first_author"].id,
    )

    draft_id = draft["evaluation_id"]

    # El lector no puede recuperar el borrador del autor.
    assert service.get_draft(
        reader.id,
        company.id,
    ) is None

    latest = service.get_latest_results(
        reader.id,
        company.id,
    )

    assert latest["evaluation_id"] == data["second"].id

    history = service.get_evaluation_history(
        reader.id,
        company.id,
    )

    assert [
        item["evaluation_id"]
        for item in history["history"]
    ] == [
        data["first"].id,
        data["second"].id,
    ]

    dashboard = service.get_historical_dashboard(
        reader.id,
        company.id,
    )

    assert draft_id not in [
        item["evaluation_id"]
        for item in dashboard["history"]
    ]

    with pytest.raises(HTTPException) as exc:
        service.get_results_by_id(
            draft_id,
            reader.id,
        )

    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc:
        service.get_comparison(
            data["second"].id,
            draft_id,
            reader.id,
            company.id,
        )

    assert exc.value.status_code == 404

def test_latest_results_endpoint_allows_non_author_member(
    client,
    db_session,
    shared_evaluation_data,
):
    data = shared_evaluation_data

    reader, _ = create_member(
        db_session,
        data["company"].id,
        CompanyRole.COLLABORATOR,
    )

    app.dependency_overrides[get_current_user] = (
        lambda: reader
    )

    try:
        response = client.get(
            "/api/evaluations/results/me",
            params={
                "company_id": data["company"].id,
            },
        )

        assert response.status_code == 200

        result = response.json()

        assert result["evaluation_id"] == data["second"].id
        assert result["global_score"] == 8
        assert len(result["ambits"]) == 3

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )
