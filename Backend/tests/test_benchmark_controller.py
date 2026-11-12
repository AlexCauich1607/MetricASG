import pytest

from app.core.roles import CompanyRole
from app.main import app
from app.models.company_membership_model import CompanyMembershipStatus
from app.models.evaluation_model import Evaluation, EvaluationStatus
from app.services.token_service import get_current_user

from tests.test_benchmark_service import (
    benchmark_data,
    create_peer,
)


@pytest.fixture
def benchmark_http_data(db_session, benchmark_data):
    data = benchmark_data

    own_evaluation = Evaluation(
        user_id=data["user"].id,
        company_id=data["company"].id,
        methodology_id=data["methodology"].id,
        status=EvaluationStatus.COMPLETED,
        global_score=7.0,
    )

    db_session.add(own_evaluation)

    for score in [6.0, 7.0, 8.0, 9.0, 10.0]:
        create_peer(
            db_session,
            data,
            score,
            ambit_scores=[score, score, score],
        )

    db_session.flush()
    return data


@pytest.fixture
def authenticated_benchmark_user(benchmark_http_data):
    user = benchmark_http_data["user"]

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        yield user
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def benchmark_params(data, **overrides):
    params = {
        "company_id": data["company"].id,
        "methodology_id": data["methodology"].id,
    }
    params.update(overrides)
    return params


def test_benchmark_requires_authentication(client, benchmark_http_data):
    response = client.get(
        "/api/benchmark",
        params=benchmark_params(benchmark_http_data),
    )

    assert response.status_code == 401


@pytest.mark.parametrize("role", list(CompanyRole))
def test_benchmark_allows_company_roles(
    client,
    db_session,
    benchmark_http_data,
    authenticated_benchmark_user,
    role,
):
    data = benchmark_http_data
    data["membership"].role = role
    db_session.flush()

    response = client.get(
        "/api/benchmark",
        params=benchmark_params(data),
    )

    assert response.status_code == 200, response.text

    body = response.json()

    assert body["available"] is True
    assert body["methodology_id"] == data["methodology"].id
    assert body["global_average"] == pytest.approx(8.0)
    assert len(body["ambits"]) == 3


def test_benchmark_rejects_inactive_membership(
    client,
    db_session,
    benchmark_http_data,
    authenticated_benchmark_user,
):
    data = benchmark_http_data
    data["membership"].status = CompanyMembershipStatus.INACTIVE
    db_session.flush()

    response = client.get(
        "/api/benchmark",
        params=benchmark_params(data),
    )

    assert response.status_code == 403


def test_benchmark_rejects_inactive_user(
    client,
    db_session,
    benchmark_http_data,
    authenticated_benchmark_user,
):
    data = benchmark_http_data
    data["user"].active = False
    db_session.flush()

    response = client.get(
        "/api/benchmark",
        params=benchmark_params(data),
    )

    assert response.status_code == 403


def test_benchmark_rejects_other_company(
    client,
    benchmark_http_data,
    authenticated_benchmark_user,
):
    data = benchmark_http_data

    other_company_id = data["company"].id + 1000000

    response = client.get(
        "/api/benchmark",
        params=benchmark_params(
            data,
            company_id=other_company_id,
        ),
    )

    assert response.status_code == 403


@pytest.mark.parametrize(
    "filter_name",
    ["sector_id", "size_id"],
)
def test_benchmark_rejects_mismatched_filters(
    client,
    benchmark_http_data,
    authenticated_benchmark_user,
    filter_name,
):
    data = benchmark_http_data

    other_id = (
        data["other_sector"].id
        if filter_name == "sector_id"
        else data["other_size"].id
    )

    response = client.get(
        "/api/benchmark",
        params=benchmark_params(
            data,
            **{filter_name: other_id},
        ),
    )

    assert response.status_code == 400


def test_benchmark_accepts_matching_filters(
    client,
    benchmark_http_data,
    authenticated_benchmark_user,
):
    data = benchmark_http_data

    response = client.get(
        "/api/benchmark",
        params=benchmark_params(
            data,
            sector_id=data["sector"].id,
            size_id=data["size"].id,
        ),
    )

    assert response.status_code == 200, response.text
    assert response.json()["global_average"] == pytest.approx(8.0)


def test_benchmark_requires_own_completed_evaluation(
    client,
    db_session,
    benchmark_http_data,
    authenticated_benchmark_user,
):
    data = benchmark_http_data

    own_evaluation = (
        db_session.query(Evaluation)
        .filter(
            Evaluation.company_id == data["company"].id,
            Evaluation.user_id == data["user"].id,
        )
        .first()
    )

    own_evaluation.status = EvaluationStatus.DRAFT
    db_session.flush()

    response = client.get(
        "/api/benchmark",
        params=benchmark_params(data),
    )

    assert response.status_code == 404


@pytest.mark.parametrize(
    "invalid_params",
    [
        {"company_id": 0},
        {"methodology_id": 0},
        {"sector_id": -1},
        {"size_id": -1},
    ],
)
def test_benchmark_rejects_invalid_parameters(
    client,
    benchmark_http_data,
    authenticated_benchmark_user,
    invalid_params,
):
    response = client.get(
        "/api/benchmark",
        params=benchmark_params(
            benchmark_http_data,
            **invalid_params,
        ),
    )

    assert response.status_code == 422


def test_benchmark_rejects_existing_foreign_company(
    client,
    db_session,
    benchmark_http_data,
    authenticated_benchmark_user,
):
    data = benchmark_http_data

    foreign_company, _ = create_peer(
        db_session,
        data,
        global_score=8.0,
    )

    response = client.get(
        "/api/benchmark",
        params=benchmark_params(
            data,
            company_id=foreign_company.id,
        ),
    )

    assert response.status_code == 403


def test_benchmark_without_filters_uses_requester_classification(
    client,
    db_session,
    benchmark_http_data,
    authenticated_benchmark_user,
):
    data = benchmark_http_data

    # Empresa adicional de otro sector: no debe alterar
    # el promedio de referencia de la empresa solicitante.
    create_peer(
        db_session,
        data,
        global_score=1.0,
        sector_id=data["other_sector"].id,
        ambit_scores=[1.0, 1.0, 1.0],
    )

    # Empresa adicional de otro tamaño: tampoco debe incluirse.
    create_peer(
        db_session,
        data,
        global_score=1.0,
        size_id=data["other_size"].id,
        ambit_scores=[1.0, 1.0, 1.0],
    )

    response = client.get(
        "/api/benchmark",
        params=benchmark_params(data),
    )

    assert response.status_code == 200

    body = response.json()

    assert body["available"] is True
    assert body["global_average"] == pytest.approx(8.0)

    for ambit in body["ambits"]:
        assert ambit["average"] == pytest.approx(8.0)


def test_benchmark_valid_filters_return_identical_aggregates(
    client,
    db_session,
    benchmark_http_data,
    authenticated_benchmark_user,
):
    data = benchmark_http_data

    # Empresas externas que no deben alterar el grupo comparable.
    create_peer(
        db_session,
        data,
        global_score=1.0,
        sector_id=data["other_sector"].id,
        ambit_scores=[1.0, 1.0, 1.0],
    )

    create_peer(
        db_session,
        data,
        global_score=2.0,
        size_id=data["other_size"].id,
        ambit_scores=[2.0, 2.0, 2.0],
    )

    variants = [
        {},
        {"sector_id": data["sector"].id},
        {"size_id": data["size"].id},
        {
            "sector_id": data["sector"].id,
            "size_id": data["size"].id,
        },
    ]

    responses = []

    for filters in variants:
        response = client.get(
            "/api/benchmark",
            params=benchmark_params(data, **filters),
        )

        assert response.status_code == 200
        responses.append(response.json())

    reference = responses[0]

    assert reference["available"] is True
    assert reference["global_average"] == pytest.approx(8.0)

    for result in responses[1:]:
        assert result == reference


def test_benchmark_suppresses_small_group_without_leaking_peer_data(
    client,
    db_session,
    benchmark_http_data,
    authenticated_benchmark_user,
):
    data = benchmark_http_data

    # Las cinco empresas iniciales están en el mismo grupo.
    # Desactivamos una para quedar por debajo del mínimo.
    peer = (
        db_session.query(Evaluation)
        .filter(
            Evaluation.company_id != data["company"].id,
            Evaluation.methodology_id == data["methodology"].id,
            Evaluation.status == EvaluationStatus.COMPLETED,
        )
        .first()
    )

    assert peer is not None

    from app.models.company_model import Company

    peer_company = db_session.get(Company, peer.company_id)
    assert peer_company is not None

    peer_company.active = False
    db_session.flush()

    response = client.get(
        "/api/benchmark",
        params=benchmark_params(data),
    )

    assert response.status_code == 200

    body = response.json()

    assert body == {
        "available": False,
        "methodology_id": data["methodology"].id,
        "global_average": None,
        "ambits": [],
    }


def test_benchmark_available_response_exposes_only_aggregates(
    client,
    benchmark_http_data,
    authenticated_benchmark_user,
):
    data = benchmark_http_data

    response = client.get(
        "/api/benchmark",
        params=benchmark_params(data),
    )

    assert response.status_code == 200

    body = response.json()

    assert set(body) == {
        "available",
        "methodology_id",
        "global_average",
        "ambits",
    }

    assert body["available"] is True
    assert body["methodology_id"] == data["methodology"].id
    assert body["global_average"] == pytest.approx(8.0)

    assert len(body["ambits"]) == 3

    for ambit in body["ambits"]:
        assert set(ambit) == {
            "ambit_id",
            "name",
            "letter",
            "average",
        }

        assert isinstance(ambit["average"], (int, float))

    # El contrato no debe publicar información individual.
    forbidden_fields = {
        "company_id",
        "company_name",
        "companies",
        "evaluation_id",
        "user_id",
        "individual_scores",
        "peer_scores",
    }

    assert forbidden_fields.isdisjoint(body.keys())

    for ambit in body["ambits"]:
        assert forbidden_fields.isdisjoint(ambit.keys())
