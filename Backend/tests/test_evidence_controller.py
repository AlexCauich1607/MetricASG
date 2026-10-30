
import pytest
from app.main import app
from app.services.token_service import get_current_user
from app.models.evaluation_indicator_response_model import (
    EvaluationIndicatorResponse,
)
from tests.test_evaluation_evidence import create_evidence_data

from app.models.evaluation_evidence_model import (
    EvaluationEvidence,
    EvidenceType,
)

from io import BytesIO

from app.models.evaluation_model import EvaluationStatus
from fastapi.testclient import TestClient

from app.controllers.evidence_controller import (
    get_evidence_storage_service,
    stream_evidence_file,
)
from app.services.evidence_storage_service import EvidenceStorageService
from tests.test_evidence_storage_service import create_valid_pdf

@pytest.mark.parametrize(
    "method, path",
    [
        ("POST", "/api/evaluations/1/evidences"),
        ("GET", "/api/evaluations/1/evidences"),
        ("GET", "/api/evaluations/1/evidences/1"),
        ("DELETE", "/api/evaluations/1/evidences/1"),
    ],
)
def test_evidence_endpoints_require_authentication(
    client,
    method,
    path,
):
    response = client.request(
        method,
        path,
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required"


def test_create_comment_evidence_http(client, db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    indicator = data["indicators"][0]
    user = data["user"]

    response = EvaluationIndicatorResponse(
        evaluation_id=evaluation.id,
        indicator_id=indicator.id,
        indicator_answer_id=data["answers"][0].id,
        maturity_level_id=data["maturity_levels"][0].id,
        score=data["maturity_levels"][0].value,
    )

    db_session.add(response)
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: user

    result = client.post(
        f"/api/evaluations/{evaluation.id}/evidences",
        json={
            "indicator_id": indicator.id,
            "type": "COMMENT",
            "content": "Evidence created through HTTP",
        },
    )

    assert result.status_code == 201

    body = result.json()

    assert body["id"] is not None
    assert body["evaluation_id"] == evaluation.id
    assert body["indicator_id"] == indicator.id
    assert body["type"] == "COMMENT"
    assert body["content"] == "Evidence created through HTTP"

    assert "storage_key" not in body
    assert "user_id" not in body


def test_create_url_evidence_http(client, db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    indicator = data["indicators"][0]
    user = data["user"]

    response = EvaluationIndicatorResponse(
        evaluation_id=evaluation.id,
        indicator_id=indicator.id,
        indicator_answer_id=data["answers"][0].id,
        maturity_level_id=data["maturity_levels"][0].id,
        score=data["maturity_levels"][0].value,
    )

    db_session.add(response)
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: user

    result = client.post(
        f"/api/evaluations/{evaluation.id}/evidences",
        json={
            "indicator_id": indicator.id,
            "type": "URL",
            "content": "https://example.com/evidence",
        },
    )

    assert result.status_code == 201

    body = result.json()

    assert body["id"] is not None
    assert body["evaluation_id"] == evaluation.id
    assert body["indicator_id"] == indicator.id
    assert body["type"] == "URL"
    assert body["content"] == "https://example.com/evidence"

    assert body["original_filename"] is None
    assert body["mime_type"] is None
    assert body["file_size"] is None

    assert "storage_key" not in body
    assert "user_id" not in body



def test_list_evidences_http(client, db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]
    first_indicator = data["indicators"][0]
    second_indicator = data["indicators"][1]

    evidences = [
        EvaluationEvidence(
            evaluation_id=evaluation.id,
            indicator_id=first_indicator.id,
            user_id=user.id,
            type=EvidenceType.COMMENT,
            content="Environmental evidence",
        ),
        EvaluationEvidence(
            evaluation_id=evaluation.id,
            indicator_id=second_indicator.id,
            user_id=user.id,
            type=EvidenceType.URL,
            content="https://example.com/evidence",
        ),
    ]

    db_session.add_all(evidences)
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: user

    # Consultar todas las evidencias.
    result = client.get(
        f"/api/evaluations/{evaluation.id}/evidences"
    )

    assert result.status_code == 200

    body = result.json()

    assert len(body) == 2
    assert {item["id"] for item in body} == {
        evidence.id for evidence in evidences
    }

    assert all("storage_key" not in item for item in body)
    assert all("user_id" not in item for item in body)

    # Consultar únicamente las evidencias del primer indicador.
    filtered_result = client.get(
        f"/api/evaluations/{evaluation.id}/evidences",
        params={"indicator_id": first_indicator.id},
    )

    assert filtered_result.status_code == 200

    filtered_body = filtered_result.json()

    assert len(filtered_body) == 1
    assert filtered_body[0]["indicator_id"] == first_indicator.id
    assert filtered_body[0]["content"] == "Environmental evidence"


def test_get_evidence_by_id_http(client, db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    indicator = data["indicators"][0]
    user = data["user"]

    evidence = EvaluationEvidence(
        evaluation_id=evaluation.id,
        indicator_id=indicator.id,
        user_id=user.id,
        type=EvidenceType.COMMENT,
        content="Specific evidence through HTTP",
    )

    db_session.add(evidence)
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: user

    result = client.get(
        f"/api/evaluations/{evaluation.id}/evidences/{evidence.id}"
    )

    assert result.status_code == 200

    body = result.json()

    assert body["id"] == evidence.id
    assert body["evaluation_id"] == evaluation.id
    assert body["indicator_id"] == indicator.id
    assert body["type"] == "COMMENT"
    assert body["content"] == "Specific evidence through HTTP"

    assert "storage_key" not in body
    assert "user_id" not in body

    assert body["created_at"] is not None
    assert body["updated_at"] is not None


def test_read_evidence_in_completed_evaluation_http(
    client,
    db_session,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    evidence = EvaluationEvidence(
        evaluation_id=evaluation.id,
        indicator_id=data["indicators"][0].id,
        user_id=user.id,
        type=EvidenceType.COMMENT,
        content="Evidence from completed evaluation",
    )

    evaluation.status = EvaluationStatus.COMPLETED

    db_session.add(evidence)
    db_session.flush()

    app.dependency_overrides[get_current_user] = lambda: user

    base_url = f"/api/evaluations/{evaluation.id}/evidences"

    # List all evidences from the completed evaluation.
    list_response = client.get(base_url)

    assert list_response.status_code == 200

    evidences = list_response.json()

    assert len(evidences) == 1
    assert evidences[0]["id"] == evidence.id

    # Get the specific evidence.
    detail_response = client.get(
        f"{base_url}/{evidence.id}"
    )

    assert detail_response.status_code == 200

    body = detail_response.json()

    assert body["id"] == evidence.id
    assert body["type"] == "COMMENT"
    assert body["content"] == (
        "Evidence from completed evaluation"
    )


@pytest.mark.parametrize(
    "evidence_type, content",
    [
        (EvidenceType.COMMENT, "Comment to delete"),
        (EvidenceType.URL, "https://example.com/to-delete"),
    ],
)
def test_delete_evidence_http(
    client,
    db_session,
    evidence_type,
    content,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    evidence = EvaluationEvidence(
        evaluation_id=evaluation.id,
        indicator_id=data["indicators"][0].id,
        user_id=user.id,
        type=evidence_type,
        content=content,
    )

    db_session.add(evidence)
    db_session.commit()

    evidence_id = evidence.id

    app.dependency_overrides[get_current_user] = lambda: user

    result = client.delete(
        f"/api/evaluations/{evaluation.id}/evidences/{evidence_id}"
    )

    assert result.status_code == 204
    assert result.content == b""

    deleted_evidence = db_session.get(
        EvaluationEvidence,
        evidence_id,
    )

    assert deleted_evidence is None


@pytest.mark.parametrize(
    "method, endpoint",
    [
        ("POST", "collection"),
        ("GET", "collection"),
        ("GET", "detail"),
        ("DELETE", "detail"),
    ],
)
def test_reject_evidence_http_from_another_user(
    client,
    db_session,
    method,
    endpoint,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    indicator = data["indicators"][0]

    evidence = EvaluationEvidence(
        evaluation_id=evaluation.id,
        indicator_id=indicator.id,
        user_id=data["user"].id,
        type=EvidenceType.COMMENT,
        content="Private evidence",
    )

    db_session.add(evidence)
    db_session.commit()

    evidence_id = evidence.id

    # Simulate an authenticated user who does not own the evaluation.
    other_user = type(
        "AuthenticatedUser",
        (),
        {"id": -1},
    )()

    app.dependency_overrides[get_current_user] = lambda: other_user

    base_url = f"/api/evaluations/{evaluation.id}/evidences"

    if endpoint == "collection":
        url = base_url
    else:
        url = f"{base_url}/{evidence_id}"

    request_kwargs = {}

    if method == "POST":
        request_kwargs["json"] = {
            "indicator_id": indicator.id,
            "type": "COMMENT",
            "content": "Unauthorized evidence",
        }

    result = client.request(
        method,
        url,
        **request_kwargs,
    )

    assert result.status_code == 404
    assert result.json()["detail"] == "Evaluation not found"

    preserved_evidence = db_session.get(
        EvaluationEvidence,
        evidence_id,
    )

    assert preserved_evidence is not None
    assert preserved_evidence.content == "Private evidence"


@pytest.mark.parametrize("method", ["POST", "DELETE"])
def test_reject_evidence_modification_in_completed_evaluation_http(
    client,
    db_session,
    method,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    indicator = data["indicators"][0]
    user = data["user"]

    evidence = EvaluationEvidence(
        evaluation_id=evaluation.id,
        indicator_id=indicator.id,
        user_id=user.id,
        type=EvidenceType.COMMENT,
        content="Evidence from completed evaluation",
    )

    evaluation.status = EvaluationStatus.COMPLETED

    db_session.add(evidence)
    db_session.commit()

    evidence_id = evidence.id

    app.dependency_overrides[get_current_user] = lambda: user

    base_url = f"/api/evaluations/{evaluation.id}/evidences"

    if method == "POST":
        result = client.post(
            base_url,
            json={
                "indicator_id": indicator.id,
                "type": "COMMENT",
                "content": "New evidence",
            },
        )
    else:
        result = client.delete(
            f"{base_url}/{evidence_id}"
        )

    assert result.status_code == 409
    assert result.json()["detail"] == (
        "Cannot modify evidence of a completed evaluation"
    )

    preserved_evidence = db_session.get(
        EvaluationEvidence,
        evidence_id,
    )

    assert preserved_evidence is not None

    evidence_count = (
        db_session.query(EvaluationEvidence)
        .filter(
            EvaluationEvidence.evaluation_id == evaluation.id,
        )
        .count()
    )

    assert evidence_count == 1


@pytest.mark.parametrize(
    "payload",
    [
        {
            "indicator_id": 1,
            "type": "COMMENT",
            "content": "",
        },
        {
            "indicator_id": 1,
            "type": "COMMENT",
            "content": "   ",
        },
        {
            "indicator_id": 1,
            "type": "COMMENT",
            "content": "A" * 2001,
        },
        {
            "indicator_id": 1,
            "type": "URL",
            "content": "http://example.com",
        },
        {
            "indicator_id": 1,
            "type": "URL",
            "content": "https://",
        },
        {
            "indicator_id": 1,
            "type": "FILE",
            "content": "document.pdf",
        },
        {
            "indicator_id": 0,
            "type": "COMMENT",
            "content": "Evidence comment",
        },
        {
            "indicator_id": 1,
            "type": "COMMENT",
            "content": "Evidence comment",
            "user_id": 100,
        },
    ],
    ids=[
        "empty-comment",
        "blank-comment",
        "comment-too-long",
        "http-url",
        "url-without-host",
        "file-type",
        "invalid-indicator",
        "extra-field",
    ],
)
def test_reject_invalid_evidence_payload_http(client, payload):
    app.dependency_overrides[get_current_user] = (
        lambda: type("AuthenticatedUser", (), {"id": 1})()
    )

    response = client.post(
        "/api/evaluations/1/evidences",
        json=payload,
    )

    assert response.status_code == 422

    body = response.json()

    assert "detail" in body
    assert isinstance(body["detail"], list)


@pytest.mark.parametrize(
    "method, endpoint",
    [
        ("POST", "collection"),
        ("GET", "collection"),
        ("GET", "detail"),
        ("DELETE", "detail"),
    ],
)
def test_evidence_endpoints_reject_nonexistent_evaluation_http(
    client,
    method,
    endpoint,
):
    app.dependency_overrides[get_current_user] = (
        lambda: type("AuthenticatedUser", (), {"id": -1})()
    )

    base_url = "/api/evaluations/999999999/evidences"

    url = (
        base_url
        if endpoint == "collection"
        else f"{base_url}/999999999"
    )

    request_kwargs = {}

    if method == "POST":
        request_kwargs["json"] = {
            "indicator_id": 1,
            "type": "COMMENT",
            "content": "Test evidence",
        }

    response = client.request(
        method,
        url,
        **request_kwargs,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Evaluation not found"


@pytest.mark.parametrize("method", ["GET", "DELETE"])
def test_evidence_endpoints_reject_nonexistent_evidence_http(
    client,
    db_session,
    method,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    db_session.commit()

    app.dependency_overrides[get_current_user] = lambda: user

    url = (
        f"/api/evaluations/{evaluation.id}"
        "/evidences/999999999"
    )

    response = client.request(method, url)

    assert response.status_code == 404
    assert response.json()["detail"] == "Evidence not found"



def test_upload_file_evidence_http(
    client,
    db_session,
    tmp_path,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    indicator = data["indicators"][0]
    user = data["user"]

    response = EvaluationIndicatorResponse(
        evaluation_id=evaluation.id,
        indicator_id=indicator.id,
        indicator_answer_id=data["answers"][0].id,
        maturity_level_id=data["maturity_levels"][0].id,
        score=data["maturity_levels"][0].value,
    )

    db_session.add(response)
    db_session.commit()

    storage = EvidenceStorageService(
        storage_path=tmp_path,
    )

    app.dependency_overrides[
        get_current_user
    ] = lambda: user

    app.dependency_overrides[
        get_evidence_storage_service
    ] = lambda: storage

    content = create_valid_pdf()

    try:
        result = client.post(
            f"/api/evaluations/{evaluation.id}/evidences/upload",
            data={
                "indicator_id": str(indicator.id),
            },
            files={
                "file": (
                    "evidencia.pdf",
                    content,
                    "application/pdf",
                ),
            },
        )

        assert result.status_code == 201, result.text

        body = result.json()

        assert body["type"] == EvidenceType.FILE.value
        assert body["original_filename"] == "evidencia.pdf"
        assert body["mime_type"] == "application/pdf"
        assert body["file_size"] == len(content)

        saved_evidence = db_session.get(
            EvaluationEvidence,
            body["id"],
        )

        assert saved_evidence is not None
        assert saved_evidence.type == EvidenceType.FILE
        assert saved_evidence.storage_key is not None

        file_path = storage.get_file(
            saved_evidence.storage_key
        )

        assert file_path.read_bytes() == content

        download_result = client.get(
            f"/api/evaluations/{evaluation.id}/evidences/"
            f"{saved_evidence.id}/download"
        )

        assert download_result.status_code == 200
        assert download_result.content == content

        assert (
            download_result.headers["content-type"]
            == "application/octet-stream"
        )

        assert (
            "attachment"
            in download_result.headers["content-disposition"]
        )

        assert (
            "evidencia.pdf"
            in download_result.headers["content-disposition"]
        )

        assert (
            download_result.headers["x-content-type-options"]
            == "nosniff"
        )

        # Eliminar la evidencia mediante HTTP.
        delete_result = client.delete(
            f"/api/evaluations/{evaluation.id}/evidences/"
            f"{saved_evidence.id}"
        )

        assert delete_result.status_code == 204

        # Confirmar que el registro desapareció de PostgreSQL.
        db_session.expire_all()

        deleted_evidence = db_session.get(
            EvaluationEvidence,
            saved_evidence.id,
        )

        assert deleted_evidence is None

        # Confirmar que el archivo físico fue eliminado.
        assert not file_path.exists()

        # La descarga posterior debe devolver 404.
        download_after_delete = client.get(
            f"/api/evaluations/{evaluation.id}/evidences/"
            f"{saved_evidence.id}/download"
        )

        assert download_after_delete.status_code == 404


    finally:
        app.dependency_overrides.pop(
            get_evidence_storage_service,
            None,
        )

        app.dependency_overrides.pop(
            get_current_user,
            None,
        )


def test_upload_file_evidence_rejects_invalid_extension_http(
    client,
    db_session,
    tmp_path,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    indicator = data["indicators"][0]
    user = data["user"]

    response = EvaluationIndicatorResponse(
        evaluation_id=evaluation.id,
        indicator_id=indicator.id,
        indicator_answer_id=data["answers"][0].id,
        maturity_level_id=data["maturity_levels"][0].id,
        score=data["maturity_levels"][0].value,
    )

    db_session.add(response)
    db_session.commit()

    storage = EvidenceStorageService(
        storage_path=tmp_path,
    )

    app.dependency_overrides[
        get_current_user
    ] = lambda: user

    app.dependency_overrides[
        get_evidence_storage_service
    ] = lambda: storage

    try:
        result = client.post(
            f"/api/evaluations/{evaluation.id}/evidences/upload",
            data={
                "indicator_id": str(indicator.id),
            },
            files={
                "file": (
                    "documento.txt",
                    b"Archivo de prueba",
                    "text/plain",
                ),
            },
        )

        assert result.status_code == 422

        evidence_count = (
            db_session.query(EvaluationEvidence)
            .filter(
                EvaluationEvidence.evaluation_id == evaluation.id,
                EvaluationEvidence.indicator_id == indicator.id,
            )
            .count()
        )

        assert evidence_count == 0
        assert list(tmp_path.iterdir()) == []

    finally:
        app.dependency_overrides.pop(
            get_evidence_storage_service,
            None,
        )

        app.dependency_overrides.pop(
            get_current_user,
            None,
        )


def test_download_file_evidence_rejects_other_user_http(
    client,
    db_session,
    tmp_path,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    indicator = data["indicators"][0]
    user = data["user"]

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
        user_id=user.id,
        type=EvidenceType.FILE,
        content=None,
        storage_key=storage_key,
        original_filename="evidencia.pdf",
        mime_type="application/pdf",
        file_size=len(content),
    )

    db_session.add(evidence)
    db_session.commit()

    app.dependency_overrides[
        get_current_user
    ] = lambda: type(
        "TestUser",
        (),
        {"id": user.id + 99999},
    )()

    app.dependency_overrides[
        get_evidence_storage_service
    ] = lambda: storage

    try:
        result = client.get(
            f"/api/evaluations/{evaluation.id}/evidences/"
            f"{evidence.id}/download"
        )

        assert result.status_code == 404

        assert result.json()["detail"] == (
            "Evaluation not found"
        )

        assert storage.get_file(
            storage_key
        ).read_bytes() == content

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )

        app.dependency_overrides.pop(
            get_evidence_storage_service,
            None,
        )


def test_download_file_evidence_missing_file_http(
    client,
    db_session,
    tmp_path,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    indicator = data["indicators"][0]
    user = data["user"]

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
        user_id=user.id,
        type=EvidenceType.FILE,
        content=None,
        storage_key=storage_key,
        original_filename="evidencia.pdf",
        mime_type="application/pdf",
        file_size=len(content),
    )

    db_session.add(evidence)
    db_session.commit()

    # Simulamos que el archivo físico desapareció.
    storage.delete_file(storage_key)

    app.dependency_overrides[
        get_current_user
    ] = lambda: user

    app.dependency_overrides[
        get_evidence_storage_service
    ] = lambda: storage

    try:
        result = client.get(
            f"/api/evaluations/{evaluation.id}/evidences/"
            f"{evidence.id}/download"
        )

        assert result.status_code == 404
        assert result.json()["detail"] == (
            "Evidence file not found"
        )

        # El fallo de descarga no debe eliminar los metadatos.
        saved_evidence = db_session.get(
            EvaluationEvidence,
            evidence.id,
        )

        assert saved_evidence is not None
        assert saved_evidence.storage_key == storage_key

    finally:
        app.dependency_overrides.pop(
            get_current_user,
            None,
        )

        app.dependency_overrides.pop(
            get_evidence_storage_service,
            None,
        )


def test_stream_evidence_file_closes_after_reading():
    content = b"Contenido de evidencia"

    file = BytesIO(content)

    chunks = list(stream_evidence_file(file))

    assert b"".join(chunks) == content
    assert file.closed


def test_stream_evidence_file_closes_on_interruption():
    content = b"A" * (128 * 1024)

    file = BytesIO(content)
    stream = stream_evidence_file(file)

    first_chunk = next(stream)

    assert len(first_chunk) == 64 * 1024
    assert not file.closed

    stream.close()

    assert file.closed
