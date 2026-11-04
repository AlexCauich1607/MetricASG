from app.main import app
from app.models.evaluation_model import EvaluationStatus
from app.services.token_service import get_current_user
from app.services.improvement_action_service import ImprovementActionService
import pytest
from tests.test_evaluation_evidence import create_evidence_data
from app.models.evaluation_indicator_response_model import (
    EvaluationIndicatorResponse,
)
from app.models.ambit_model import Ambit
from app.models.indicator_model import Indicator
from app.models.methodology_model import Methodology, MethodologyStatus
from app.models.improvement_action_model import (
    ImprovementAction,
    ImprovementStatus,
)
def test_create_improvement_action_http(client, db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    evaluation.status = EvaluationStatus.COMPLETED
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: user

    response = client.post(
        f"/api/evaluations/{evaluation.id}/improvement-actions",
        json={
            "gap_description": "Consumo energético elevado",
            "description": "Implementar iluminación LED",
            "priority": "HIGH",
            "responsible": "Operaciones",
            "target_date": "2026-12-15",
        },
    )

    assert response.status_code == 201, response.text

    body = response.json()

    assert body["id"] is not None
    assert body["evaluation_id"] == evaluation.id
    assert body["indicator_id"] is None
    assert body["gap_description"] == "Consumo energético elevado"
    assert body["description"] == "Implementar iluminación LED"
    assert body["priority"] == "HIGH"
    assert body["responsible"] == "Operaciones"
    assert body["target_date"] == "2026-12-15"
    assert body["status"] == "PENDING"

    assert body["created_at"] is not None
    assert body["updated_at"] is not None


def test_list_and_get_improvement_actions_http(client, db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    evaluation.status = EvaluationStatus.COMPLETED
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: user

    base = f"/api/evaluations/{evaluation.id}/improvement-actions"

    payloads = [
        {
            "gap_description": "Consumo energético elevado",
            "description": "Implementar iluminación LED",
            "priority": "HIGH",
            "responsible": "Operaciones",
            "target_date": "2026-12-15",
        },
        {
            "gap_description": "Gestión de residuos insuficiente",
            "description": "Implementar separación de residuos",
            "priority": "MEDIUM",
            "responsible": "Administración",
            "target_date": "2027-01-15",
        },
    ]

    action_ids = []

    for payload in payloads:
        response = client.post(base, json=payload)

        assert response.status_code == 201, response.text
        action_ids.append(response.json()["id"])

    # Consultar el listado.
    response = client.get(base)

    assert response.status_code == 200, response.text

    actions = response.json()
    returned_ids = [action["id"] for action in actions]

    assert len(actions) == 2
    assert returned_ids == action_ids

    # Consultar cada acción individualmente.
    for action_id, payload in zip(action_ids, payloads):
        response = client.get(f"{base}/{action_id}")

        assert response.status_code == 200, response.text

        action = response.json()

        assert action["id"] == action_id
        assert action["evaluation_id"] == evaluation.id
        assert action["description"] == payload["description"]
        assert action["priority"] == payload["priority"]


def test_update_and_delete_improvement_action_http(client, db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    evaluation.status = EvaluationStatus.COMPLETED
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: user

    base = f"/api/evaluations/{evaluation.id}/improvement-actions"

    # Crear una acción de mejora.
    response = client.post(
        base,
        json={
            "gap_description": "Consumo energético elevado",
            "description": "Reducir consumo energético",
            "priority": "MEDIUM",
            "responsible": "Operaciones",
            "target_date": "2026-12-15",
        },
    )

    assert response.status_code == 201, response.text

    action_id = response.json()["id"]

    # Actualizar parcialmente la acción.
    response = client.patch(
        f"{base}/{action_id}",
        json={
            "description": "Implementar iluminación LED",
            "priority": "HIGH",
            "status": "IN_PROGRESS",
        },
    )

    assert response.status_code == 200, response.text

    updated = response.json()

    assert updated["description"] == "Implementar iluminación LED"
    assert updated["priority"] == "HIGH"
    assert updated["status"] == "IN_PROGRESS"
    assert updated["responsible"] == "Operaciones"

    # Confirmar los cambios mediante GET.
    response = client.get(f"{base}/{action_id}")

    assert response.status_code == 200, response.text
    assert response.json()["description"] == (
        "Implementar iluminación LED"
    )

    # Eliminar la acción.
    response = client.delete(f"{base}/{action_id}")

    assert response.status_code == 204, response.text
    assert response.content == b""

    # La acción eliminada ya no debe existir.
    response = client.get(f"{base}/{action_id}")

    assert response.status_code == 404

    # El listado tampoco debe incluirla.
    response = client.get(base)

    assert response.status_code == 200
    assert all(
        action["id"] != action_id
        for action in response.json()
    )



@pytest.mark.parametrize(
    "method, endpoint, payload",
    [
        ("POST", "collection", {
            "gap_description": "Consumo elevado",
            "description": "Reducir consumo",
            "responsible": "Operaciones",
            "target_date": "2026-12-15",
        }),
        ("GET", "collection", None),
        ("GET", "detail", None),
        ("PATCH", "detail", {
            "description": "Modificación no autorizada",
        }),
        ("DELETE", "detail", None),
    ],
)
def test_reject_improvement_action_from_another_user_http(
    client,
    db_session,
    method,
    endpoint,
    payload,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    evaluation.status = EvaluationStatus.COMPLETED
    db_session.flush()

    # Crear una acción real como propietario.
    app.dependency_overrides[get_current_user] = lambda: user

    base = f"/api/evaluations/{evaluation.id}/improvement-actions"

    response = client.post(
        base,
        json={
            "gap_description": "Consumo energético elevado",
            "description": "Acción protegida",
            "responsible": "Operaciones",
            "target_date": "2026-12-15",
        },
    )

    assert response.status_code == 201, response.text

    action_id = response.json()["id"]

    # Simular otro usuario autenticado.
    app.dependency_overrides[get_current_user] = (
        lambda: type("OtherUser", (), {"id": -1})()
    )

    path = (
        base
        if endpoint == "collection"
        else f"{base}/{action_id}"
    )

    response = client.request(
        method,
        path,
        json=payload,
    )

    assert response.status_code == 404, response.text

    # El propietario debe conservar el acceso.
    app.dependency_overrides[get_current_user] = lambda: user

    response = client.get(f"{base}/{action_id}")

    assert response.status_code == 200
    assert response.json()["description"] == "Acción protegida"


def test_reject_improvement_action_in_draft_evaluation_http(
    client,
    db_session,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    assert evaluation.status == EvaluationStatus.DRAFT

    # Confirmar los datos de preparación dentro de la
    # transacción externa controlada por el fixture.
    db_session.commit()

    app.dependency_overrides[get_current_user] = lambda: user

    base = f"/api/evaluations/{evaluation.id}/improvement-actions"

    response = client.post(
        base,
        json={
            "gap_description": "Consumo energético elevado",
            "description": "Implementar iluminación LED",
            "priority": "HIGH",
            "responsible": "Operaciones",
            "target_date": "2026-12-15",
        },
    )

    assert response.status_code == 409, response.text
    assert response.json()["detail"] == (
        "Improvement actions require a completed evaluation"
    )

    # Comprobar que no se creó ninguna acción.
    response = client.get(base)

    assert response.status_code == 200
    assert response.json() == []


def test_create_improvement_action_with_indicator_http(
    client,
    db_session,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    indicator = data["indicators"][0]
    user = data["user"]

    # Registrar una respuesta para el indicador.
    indicator_response = EvaluationIndicatorResponse(
        evaluation_id=evaluation.id,
        indicator_id=indicator.id,
        indicator_answer_id=data["answers"][0].id,
        maturity_level_id=data["maturity_levels"][0].id,
        score=data["maturity_levels"][0].value,
    )

    db_session.add(indicator_response)

    evaluation.status = EvaluationStatus.COMPLETED
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: user

    base = f"/api/evaluations/{evaluation.id}/improvement-actions"

    response = client.post(
        base,
        json={
            "indicator_id": indicator.id,
            "gap_description": "Consumo energético elevado",
            "description": "Implementar iluminación LED",
            "priority": "HIGH",
            "responsible": "Operaciones",
            "target_date": "2026-12-15",
        },
    )

    assert response.status_code == 201, response.text

    body = response.json()

    assert body["evaluation_id"] == evaluation.id
    assert body["indicator_id"] == indicator.id
    assert body["status"] == "PENDING"

    # Confirmar que la asociación se conserva.
    response = client.get(f"{base}/{body['id']}")

    assert response.status_code == 200, response.text
    assert response.json()["indicator_id"] == indicator.id


def test_reject_improvement_action_without_indicator_response_http(
    client,
    db_session,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    indicator = data["indicators"][0]
    user = data["user"]

    # Completar la evaluación sin registrar
    # una respuesta para el indicador.
    evaluation.status = EvaluationStatus.COMPLETED
    db_session.flush()

    # Conservar los datos de preparación ante el
    # rollback del servicio cuando devuelve HTTP 422.
    db_session.commit()

    app.dependency_overrides[get_current_user] = lambda: user

    base = f"/api/evaluations/{evaluation.id}/improvement-actions"

    response = client.post(
        base,
        json={
            "indicator_id": indicator.id,
            "gap_description": "Consumo energético elevado",
            "description": "Implementar iluminación LED",
            "priority": "HIGH",
            "responsible": "Operaciones",
            "target_date": "2026-12-15",
        },
    )

    assert response.status_code == 422, response.text
    assert response.json()["detail"] == (
        "Indicator has no saved response in this evaluation"
    )

    # Verificar que no se creó una acción.
    response = client.get(base)

    assert response.status_code == 200, response.text
    assert response.json() == []


def test_reject_improvement_action_from_another_methodology_http(
    client,
    db_session,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    # Crear una segunda metodología independiente.
    other_methodology = Methodology(
        name="Other Improvement Test Methodology",
        version="TEST-IMPROVEMENT-OTHER-1",
        status=MethodologyStatus.PUBLISHED,
        is_active=False,
    )

    db_session.add(other_methodology)
    db_session.flush()

    other_ambit = Ambit(
        name="Ambiental",
        description="",
        letter="A",
        color="#37AB48",
        is_removable=False,
        methodology_id=other_methodology.id,
    )

    db_session.add(other_ambit)
    db_session.flush()

    other_indicator = Indicator(
        ambit_id=other_ambit.id,
        question="Indicator from another methodology",
    )

    db_session.add(other_indicator)
    db_session.flush()

    assert (
        evaluation.methodology_id
        != other_methodology.id
    )

    evaluation.status = EvaluationStatus.COMPLETED

    # Conservar los datos de preparación durante
    # el rollback provocado por el rechazo HTTP 422.
    db_session.commit()

    app.dependency_overrides[get_current_user] = lambda: user

    base = f"/api/evaluations/{evaluation.id}/improvement-actions"

    response = client.post(
        base,
        json={
            "indicator_id": other_indicator.id,
            "gap_description": "Consumo energético elevado",
            "description": "Implementar iluminación LED",
            "priority": "HIGH",
            "responsible": "Operaciones",
            "target_date": "2026-12-15",
        },
    )

    assert response.status_code == 422, response.text
    assert response.json()["detail"] == (
        "Indicator does not belong to evaluation methodology"
    )

    # Verificar que no se creó ninguna acción.
    response = client.get(base)

    assert response.status_code == 200, response.text
    assert response.json() == []


def test_reject_update_to_indicator_without_response_http(
    client,
    db_session,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]
    indicator = data["indicators"][0]

    evaluation.status = EvaluationStatus.COMPLETED
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: user

    base = f"/api/evaluations/{evaluation.id}/improvement-actions"

    # Crear una acción general, sin indicador.
    response = client.post(
        base,
        json={
            "gap_description": "Consumo energético elevado",
            "description": "Reducir consumo energético",
            "priority": "MEDIUM",
            "responsible": "Operaciones",
            "target_date": "2026-12-15",
        },
    )

    assert response.status_code == 201, response.text
    action_id = response.json()["id"]

    # Intentar asociarla con un indicador sin respuesta.
    response = client.patch(
        f"{base}/{action_id}",
        json={
            "indicator_id": indicator.id,
        },
    )

    assert response.status_code == 422, response.text
    assert response.json()["detail"] == (
        "Indicator has no saved response in this evaluation"
    )

    # Comprobar que la acción conserva su asociación original.
    response = client.get(f"{base}/{action_id}")

    assert response.status_code == 200, response.text
    assert response.json()["indicator_id"] is None
    assert response.json()["description"] == (
        "Reducir consumo energético"
    )


@pytest.mark.parametrize(
    "field",
    [
        "gap_description",
        "description",
        "priority",
        "responsible",
        "target_date",
        "status",
    ],
)
def test_reject_null_required_fields_on_update_http(
    client,
    db_session,
    field,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    evaluation.status = EvaluationStatus.COMPLETED
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: user

    base = f"/api/evaluations/{evaluation.id}/improvement-actions"

    response = client.post(
        base,
        json={
            "gap_description": "Consumo energético elevado",
            "description": "Reducir consumo energético",
            "priority": "MEDIUM",
            "responsible": "Operaciones",
            "target_date": "2026-12-15",
        },
    )

    assert response.status_code == 201, response.text

    action_id = response.json()["id"]
    original = response.json()

    # Intentar asignar null a un campo obligatorio.
    response = client.patch(
        f"{base}/{action_id}",
        json={field: None},
    )

    assert response.status_code == 422, response.text

    # Comprobar que la acción no fue modificada.
    response = client.get(f"{base}/{action_id}")

    assert response.status_code == 200, response.text
    assert response.json()[field] == original[field]


def test_improvement_progress_metrics_without_actions(db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    evaluation.status = EvaluationStatus.COMPLETED
    db_session.flush()

    service = ImprovementActionService(db_session)

    metrics = service.get_progress_metrics(
        evaluation_id=evaluation.id,
        user_id=user.id,
    )

    assert metrics == {
        "evaluation_id": evaluation.id,
        "total": 0,
        "pending": 0,
        "in_progress": 0,
        "completed": 0,
        "cancelled": 0,
        "progress_percentage": 0.0,
    }


def test_improvement_progress_metrics_with_mixed_statuses(db_session):
    from datetime import date

    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    evaluation.status = EvaluationStatus.COMPLETED
    db_session.flush()

    statuses = [
        ImprovementStatus.PENDING,
        ImprovementStatus.PENDING,
        ImprovementStatus.IN_PROGRESS,
        ImprovementStatus.IN_PROGRESS,
        ImprovementStatus.IN_PROGRESS,
        ImprovementStatus.COMPLETED,
        ImprovementStatus.COMPLETED,
        ImprovementStatus.COMPLETED,
        ImprovementStatus.COMPLETED,
        ImprovementStatus.CANCELLED,
    ]

    for index, action_status in enumerate(statuses, start=1):
        db_session.add(
            ImprovementAction(
                evaluation_id=evaluation.id,
                indicator_id=None,
                gap_description=f"Brecha {index}",
                description=f"Acción de mejora {index}",
                priority="MEDIUM",
                responsible="Operaciones",
                target_date=date(2026, 12, 15),
                status=action_status,
            )
        )

    db_session.flush()

    service = ImprovementActionService(db_session)

    metrics = service.get_progress_metrics(
        evaluation_id=evaluation.id,
        user_id=user.id,
    )

    assert metrics == {
        "evaluation_id": evaluation.id,
        "total": 10,
        "pending": 2,
        "in_progress": 3,
        "completed": 4,
        "cancelled": 1,
        "progress_percentage": 44.44,
    }


@pytest.mark.parametrize(
    ("action_status", "expected_progress"),
    [
        (ImprovementStatus.COMPLETED, 100.0),
        (ImprovementStatus.CANCELLED, 0.0),
    ],
)
def test_improvement_progress_metrics_edge_cases(
    db_session,
    action_status,
    expected_progress,
):
    from datetime import date

    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    evaluation.status = EvaluationStatus.COMPLETED
    db_session.flush()

    for index in range(3):
        db_session.add(
            ImprovementAction(
                evaluation_id=evaluation.id,
                indicator_id=None,
                gap_description=f"Brecha {index}",
                description=f"Acción {index}",
                priority="MEDIUM",
                responsible="Operaciones",
                target_date=date(2026, 12, 15),
                status=action_status,
            )
        )

    db_session.flush()

    service = ImprovementActionService(db_session)

    metrics = service.get_progress_metrics(
        evaluation_id=evaluation.id,
        user_id=user.id,
    )

    assert metrics["total"] == 3
    assert metrics["progress_percentage"] == expected_progress

    if action_status == ImprovementStatus.COMPLETED:
        assert metrics["completed"] == 3
        assert metrics["cancelled"] == 0
    else:
        assert metrics["completed"] == 0
        assert metrics["cancelled"] == 3


def test_improvement_progress_metrics_rejects_other_user(db_session):
    from fastapi import HTTPException

    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    evaluation.status = EvaluationStatus.COMPLETED
    db_session.flush()

    service = ImprovementActionService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.get_progress_metrics(
            evaluation_id=evaluation.id,
            user_id=user.id + 99999,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Evaluation not found"


def test_improvement_progress_endpoint_without_actions(
    client,
    db_session,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    evaluation.status = EvaluationStatus.COMPLETED
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: user

    response = client.get(
        f"/api/evaluations/{evaluation.id}/improvement-actions/progress"
    )

    assert response.status_code == 200, response.text

    assert response.json() == {
        "evaluation_id": evaluation.id,
        "total": 0,
        "pending": 0,
        "in_progress": 0,
        "completed": 0,
        "cancelled": 0,
        "progress_percentage": 0.0,
    }


def test_improvement_progress_endpoint_with_mixed_statuses(
    client,
    db_session,
):
    from datetime import date

    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    evaluation.status = EvaluationStatus.COMPLETED
    db_session.flush()

    statuses = [
        ImprovementStatus.PENDING,
        ImprovementStatus.IN_PROGRESS,
        ImprovementStatus.COMPLETED,
        ImprovementStatus.COMPLETED,
        ImprovementStatus.CANCELLED,
    ]

    for index, action_status in enumerate(statuses, start=1):
        db_session.add(
            ImprovementAction(
                evaluation_id=evaluation.id,
                indicator_id=None,
                gap_description=f"Brecha {index}",
                description=f"Acción de mejora {index}",
                priority="MEDIUM",
                responsible="Operaciones",
                target_date=date(2026, 12, 15),
                status=action_status,
            )
        )

    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: user

    response = client.get(
        f"/api/evaluations/{evaluation.id}/improvement-actions/progress"
    )

    assert response.status_code == 200, response.text

    assert response.json() == {
        "evaluation_id": evaluation.id,
        "total": 5,
        "pending": 1,
        "in_progress": 1,
        "completed": 2,
        "cancelled": 1,
        "progress_percentage": 50.0,
    }


def test_improvement_progress_endpoint_rejects_other_user(
    client,
    db_session,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    owner = data["user"]

    evaluation.status = EvaluationStatus.COMPLETED
    db_session.flush()

    # Simular un usuario diferente al propietario.
    other_user = type(
        "AuthenticatedUser",
        (),
        {"id": owner.id + 99999},
    )()

    app.dependency_overrides[get_current_user] = lambda: other_user

    response = client.get(
        f"/api/evaluations/{evaluation.id}/improvement-actions/progress"
    )

    assert response.status_code == 404
    assert response.json() == {
        "detail": "Evaluation not found"
    }


def test_list_improvement_actions_requires_authentication(client):
    response = client.get(
        "/api/evaluations/1/improvement-actions"
    )

    assert response.status_code == 401


def test_improvement_progress_requires_authentication(client):
    response = client.get(
        "/api/evaluations/1/improvement-actions/progress"
    )

    assert response.status_code == 401
