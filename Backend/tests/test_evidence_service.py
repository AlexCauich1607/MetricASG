
import pytest
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers
from sqlalchemy.exc import SQLAlchemyError

from unittest.mock import patch
from app.models.methodology_model import Methodology
from app.models.evaluation_evidence_request import EvidenceCreateRequest
from app.models.ambit_model import Ambit
from app.models.indicator_model import Indicator
from app.models.evaluation_indicator_response_model import (
    EvaluationIndicatorResponse,
)

from app.models.evaluation_evidence_model import (
    EvaluationEvidence,
    EvidenceType,
)

from app.models.evaluation_indicator_response_model import (
    EvaluationIndicatorResponse,
)

from app.models.evaluation_model import Evaluation, EvaluationStatus
from app.services.evidence_service import EvidenceService
from tests.test_evaluation_evidence import create_evidence_data

from app.models.methodology_model import Methodology
from app.models.ambit_model import Ambit
from app.models.indicator_model import Indicator
from io import BytesIO

from app.services.evidence_storage_service import EvidenceStorageService
from tests.test_evidence_storage_service import create_valid_pdf

def test_get_owned_evaluation(db_session):
    data = create_evidence_data(db_session)

    service = EvidenceService(db_session)

    evaluation = service.get_evaluation_or_error(
        evaluation_id=data["evaluation"].id,
        user_id=data["user"].id,
    )

    assert evaluation.id == data["evaluation"].id


def test_reject_nonexistent_evaluation(db_session):
    data = create_evidence_data(db_session)

    service = EvidenceService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.get_evaluation_or_error(
            evaluation_id=-1,
            user_id=data["user"].id,
        )

    assert exc_info.value.status_code == 404


def test_reject_evaluation_from_another_user(db_session):
    data = create_evidence_data(db_session)

    service = EvidenceService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.get_evaluation_or_error(
            evaluation_id=data["evaluation"].id,
            user_id=-1,
        )

    assert exc_info.value.status_code == 404


def test_allow_draft_evaluation_modification(db_session):
    data = create_evidence_data(db_session)

    service = EvidenceService(db_session)

    service.validate_evaluation_editable(
        data["evaluation"]
    )

    assert data["evaluation"].status == EvaluationStatus.DRAFT


def test_reject_completed_evaluation_modification(db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    evaluation.status = EvaluationStatus.COMPLETED

    service = EvidenceService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.validate_evaluation_editable(evaluation)

    assert exc_info.value.status_code == 409


def test_allow_indicator_with_saved_response(db_session):
    data = create_evidence_data(db_session)

    indicator = data["indicators"][0]

    response = EvaluationIndicatorResponse(
        evaluation_id=data["evaluation"].id,
        indicator_id=indicator.id,
        indicator_answer_id=data["answers"][0].id,
        maturity_level_id=data["maturity_levels"][0].id,
        score=data["maturity_levels"][0].value,
    )

    db_session.add(response)
    db_session.flush()

    service = EvidenceService(db_session)

    service.validate_indicator_response(
        data["evaluation"],
        indicator.id,
    )


def test_reject_indicator_without_saved_response(db_session):
    data = create_evidence_data(db_session)

    service = EvidenceService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.validate_indicator_response(
            data["evaluation"],
            data["indicators"][0].id,
        )

    assert exc_info.value.status_code == 422
    assert (
        exc_info.value.detail
        == "Indicator has no saved response in this evaluation"
    )


def test_reject_nonexistent_indicator(db_session):
    data = create_evidence_data(db_session)

    service = EvidenceService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.validate_indicator_response(
            data["evaluation"],
            -1,
        )

    assert exc_info.value.status_code == 422
    assert (
        exc_info.value.detail
        == "Indicator does not belong to evaluation methodology"
    )


def test_reject_indicator_from_another_methodology(db_session):
    data = create_evidence_data(db_session)

    other_methodology = Methodology(
        name="Other methodology",
        version="1.0",
    )

    db_session.add(other_methodology)
    db_session.flush()

    other_ambit = Ambit(
        methodology_id=other_methodology.id,
        name="Other ambit",
    )

    db_session.add(other_ambit)
    db_session.flush()

    other_indicator = Indicator(
        ambit_id=other_ambit.id,
        question="Other methodology indicator",
    )

    db_session.add(other_indicator)
    db_session.flush()

    service = EvidenceService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.validate_indicator_response(
            data["evaluation"],
            other_indicator.id,
        )

    assert exc_info.value.status_code == 422
    assert (
        exc_info.value.detail
        == "Indicator does not belong to evaluation methodology"
    )


@pytest.mark.parametrize("evidence_count", [0, 1, 4])
def test_allow_evidence_below_limit(db_session, evidence_count):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    indicator = data["indicators"][0]
    user = data["user"]

    for index in range(evidence_count):
        db_session.add(
            EvaluationEvidence(
                evaluation_id=evaluation.id,
                indicator_id=indicator.id,
                user_id=user.id,
                type=EvidenceType.COMMENT,
                content=f"Evidence {index + 1}",
            )
        )

    db_session.flush()

    service = EvidenceService(db_session)

    service.validate_evidence_limit(
        evaluation.id,
        indicator.id,
    )


def test_reject_evidence_when_limit_reached(db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    indicator = data["indicators"][0]
    user = data["user"]

    for index in range(5):
        db_session.add(
            EvaluationEvidence(
                evaluation_id=evaluation.id,
                indicator_id=indicator.id,
                user_id=user.id,
                type=EvidenceType.COMMENT,
                content=f"Evidence {index + 1}",
            )
        )

    db_session.flush()

    service = EvidenceService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.validate_evidence_limit(
            evaluation.id,
            indicator.id,
        )

    assert exc_info.value.status_code == 409
    assert (
        exc_info.value.detail
        == "Maximum of 5 evidences per indicator reached"
    )


def test_evidence_limit_is_independent_per_indicator(db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    first_indicator = data["indicators"][0]
    second_indicator = data["indicators"][1]
    user = data["user"]

    for index in range(5):
        db_session.add(
            EvaluationEvidence(
                evaluation_id=evaluation.id,
                indicator_id=first_indicator.id,
                user_id=user.id,
                type=EvidenceType.COMMENT,
                content=f"Evidence {index + 1}",
            )
        )

    db_session.flush()

    service = EvidenceService(db_session)

    service.validate_evidence_limit(
        evaluation.id,
        second_indicator.id,
    )


def test_create_comment_evidence(db_session):
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

    payload = EvidenceCreateRequest(
        indicator_id=indicator.id,
        type="COMMENT",
        content="Evidence comment",
    )

    service = EvidenceService(db_session)

    evidence = service.create_evidence(
        evaluation_id=evaluation.id,
        user_id=user.id,
        payload=payload,
    )

    assert evidence.id is not None
    assert evidence.evaluation_id == evaluation.id
    assert evidence.indicator_id == indicator.id
    assert evidence.user_id == user.id
    assert evidence.type == EvidenceType.COMMENT
    assert evidence.content == "Evidence comment"

    saved_evidence = db_session.get(
        EvaluationEvidence,
        evidence.id,
    )

    assert saved_evidence is not None


def test_create_url_evidence(db_session):
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

    payload = EvidenceCreateRequest(
        indicator_id=indicator.id,
        type="URL",
        content="https://example.com/evidence",
    )

    service = EvidenceService(db_session)

    evidence = service.create_evidence(
        evaluation_id=evaluation.id,
        user_id=user.id,
        payload=payload,
    )

    assert evidence.id is not None
    assert evidence.type == EvidenceType.URL
    assert evidence.content == "https://example.com/evidence"
    assert evidence.storage_key is None
    assert evidence.original_filename is None
    assert evidence.mime_type is None
    assert evidence.file_size is None

    saved_evidence = db_session.get(
        EvaluationEvidence,
        evidence.id,
    )

    assert saved_evidence is not None


def test_reject_create_evidence_in_completed_evaluation(db_session):
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

    evaluation.status = EvaluationStatus.COMPLETED

    db_session.flush()

    payload = EvidenceCreateRequest(
        indicator_id=indicator.id,
        type="COMMENT",
        content="Evidence after completion",
    )

    service = EvidenceService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.create_evidence(
            evaluation_id=evaluation.id,
            user_id=user.id,
            payload=payload,
        )

    assert exc_info.value.status_code == 409

    evidence_count = (
        db_session.query(EvaluationEvidence)
        .filter(
            EvaluationEvidence.evaluation_id == evaluation.id,
            EvaluationEvidence.indicator_id == indicator.id,
        )
        .count()
    )

    assert evidence_count == 0


@pytest.mark.parametrize(
    "invalid_access",
    ["nonexistent_evaluation", "another_user"],
)
def test_reject_create_evidence_without_access(
    db_session,
    invalid_access,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    indicator = data["indicators"][0]
    user = data["user"]

    payload = EvidenceCreateRequest(
        indicator_id=indicator.id,
        type="COMMENT",
        content="Unauthorized evidence",
    )

    evaluation_id = evaluation.id
    user_id = user.id

    if invalid_access == "nonexistent_evaluation":
        evaluation_id = -1
    else:
        user_id = -1

    service = EvidenceService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.create_evidence(
            evaluation_id=evaluation_id,
            user_id=user_id,
            payload=payload,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Evaluation not found"

    evidence_count = (
        db_session.query(EvaluationEvidence)
        .filter(
            EvaluationEvidence.evaluation_id == evaluation.id,
        )
        .count()
    )

    assert evidence_count == 0


def test_reject_create_evidence_without_saved_response(db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    indicator = data["indicators"][0]
    user = data["user"]

    payload = EvidenceCreateRequest(
        indicator_id=indicator.id,
        type="COMMENT",
        content="Evidence without saved response",
    )

    service = EvidenceService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.create_evidence(
            evaluation_id=evaluation.id,
            user_id=user.id,
            payload=payload,
        )

    assert exc_info.value.status_code == 422
    assert (
        exc_info.value.detail
        == "Indicator has no saved response in this evaluation"
    )

    evidence_count = (
        db_session.query(EvaluationEvidence)
        .filter(
            EvaluationEvidence.evaluation_id == evaluation.id,
            EvaluationEvidence.indicator_id == indicator.id,
        )
        .count()
    )

    assert evidence_count == 0


def test_reject_create_evidence_when_limit_reached(db_session):
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

    for index in range(5):
        db_session.add(
            EvaluationEvidence(
                evaluation_id=evaluation.id,
                indicator_id=indicator.id,
                user_id=user.id,
                type=EvidenceType.COMMENT,
                content=f"Existing evidence {index + 1}",
            )
        )

    db_session.commit()

    payload = EvidenceCreateRequest(
        indicator_id=indicator.id,
        type="COMMENT",
        content="Sixth evidence",
    )

    service = EvidenceService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.create_evidence(
            evaluation_id=evaluation.id,
            user_id=user.id,
            payload=payload,
        )

    assert exc_info.value.status_code == 409
    assert (
        exc_info.value.detail
        == "Maximum of 5 evidences per indicator reached"
    )

    evidence_count = (
        db_session.query(EvaluationEvidence)
        .filter(
            EvaluationEvidence.evaluation_id == evaluation.id,
            EvaluationEvidence.indicator_id == indicator.id,
        )
        .count()
    )

    assert evidence_count == 5


def test_list_evidences_by_evaluation(db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    evidences = [
        EvaluationEvidence(
            evaluation_id=evaluation.id,
            indicator_id=data["indicators"][0].id,
            user_id=user.id,
            type=EvidenceType.COMMENT,
            content="First evidence",
        ),
        EvaluationEvidence(
            evaluation_id=evaluation.id,
            indicator_id=data["indicators"][1].id,
            user_id=user.id,
            type=EvidenceType.URL,
            content="https://example.com/evidence",
        ),
    ]

    db_session.add_all(evidences)
    db_session.flush()

    service = EvidenceService(db_session)

    result = service.list_evidences(
        evaluation_id=evaluation.id,
        user_id=user.id,
    )

    assert len(result) == 2
    assert {item.id for item in result} == {
        evidence.id for evidence in evidences
    }


def test_list_evidences_filtered_by_indicator(db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]
    first_indicator = data["indicators"][0]
    second_indicator = data["indicators"][1]

    db_session.add_all([
        EvaluationEvidence(
            evaluation_id=evaluation.id,
            indicator_id=first_indicator.id,
            user_id=user.id,
            type=EvidenceType.COMMENT,
            content="First indicator evidence",
        ),
        EvaluationEvidence(
            evaluation_id=evaluation.id,
            indicator_id=second_indicator.id,
            user_id=user.id,
            type=EvidenceType.COMMENT,
            content="Second indicator evidence",
        ),
    ])

    db_session.flush()

    service = EvidenceService(db_session)

    result = service.list_evidences(
        evaluation_id=evaluation.id,
        user_id=user.id,
        indicator_id=first_indicator.id,
    )

    assert len(result) == 1
    assert result[0].indicator_id == first_indicator.id
    assert result[0].content == "First indicator evidence"


def test_get_evidence_by_id(db_session):
    data = create_evidence_data(db_session)

    evidence = EvaluationEvidence(
        evaluation_id=data["evaluation"].id,
        indicator_id=data["indicators"][0].id,
        user_id=data["user"].id,
        type=EvidenceType.COMMENT,
        content="Specific evidence",
    )

    db_session.add(evidence)
    db_session.flush()

    service = EvidenceService(db_session)

    result = service.get_evidence_or_error(
        evaluation_id=data["evaluation"].id,
        evidence_id=evidence.id,
        user_id=data["user"].id,
    )

    assert result.id == evidence.id
    assert result.content == "Specific evidence"


def test_reject_nonexistent_evidence(db_session):
    data = create_evidence_data(db_session)

    service = EvidenceService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.get_evidence_or_error(
            evaluation_id=data["evaluation"].id,
            evidence_id=-1,
            user_id=data["user"].id,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Evidence not found"


@pytest.mark.parametrize(
    "operation",
    ["list", "get"],
)
def test_reject_evidence_read_from_another_user(
    db_session,
    operation,
):
    data = create_evidence_data(db_session)

    evidence = EvaluationEvidence(
        evaluation_id=data["evaluation"].id,
        indicator_id=data["indicators"][0].id,
        user_id=data["user"].id,
        type=EvidenceType.COMMENT,
        content="Private evidence",
    )

    db_session.add(evidence)
    db_session.flush()

    service = EvidenceService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        if operation == "list":
            service.list_evidences(
                evaluation_id=data["evaluation"].id,
                user_id=-1,
            )
        else:
            service.get_evidence_or_error(
                evaluation_id=data["evaluation"].id,
                evidence_id=evidence.id,
                user_id=-1,
            )

    assert exc_info.value.status_code == 404


def test_allow_read_evidence_in_completed_evaluation(db_session):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    evaluation.status = EvaluationStatus.COMPLETED

    evidence = EvaluationEvidence(
        evaluation_id=evaluation.id,
        indicator_id=data["indicators"][0].id,
        user_id=data["user"].id,
        type=EvidenceType.COMMENT,
        content="Completed evaluation evidence",
    )

    db_session.add(evidence)
    db_session.flush()

    service = EvidenceService(db_session)

    result = service.get_evidence_or_error(
        evaluation_id=evaluation.id,
        evidence_id=evidence.id,
        user_id=data["user"].id,
    )

    assert result.id == evidence.id
    assert evaluation.status == EvaluationStatus.COMPLETED


@pytest.mark.parametrize(
    "evidence_type, content",
    [
        (EvidenceType.COMMENT, "Evidence to delete"),
        (EvidenceType.URL, "https://example.com/evidence"),
    ],
)
def test_delete_text_evidence(
    db_session,
    evidence_type,
    content,
):
    data = create_evidence_data(db_session)

    evidence = EvaluationEvidence(
        evaluation_id=data["evaluation"].id,
        indicator_id=data["indicators"][0].id,
        user_id=data["user"].id,
        type=evidence_type,
        content=content,
    )

    db_session.add(evidence)
    db_session.commit()

    evidence_id = evidence.id
    evaluation_id = data["evaluation"].id
    user_id = data["user"].id

    service = EvidenceService(db_session)

    result = service.delete_evidence(
        evaluation_id=evaluation_id,
        evidence_id=evidence_id,
        user_id=user_id,
    )

    assert result is None

    deleted_evidence = db_session.get(
        EvaluationEvidence,
        evidence_id,
    )

    assert deleted_evidence is None


@pytest.mark.parametrize(
    "invalid_access",
    ["nonexistent_evaluation", "another_user"],
)
def test_reject_delete_evidence_without_access(
    db_session,
    invalid_access,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    evidence = EvaluationEvidence(
        evaluation_id=evaluation.id,
        indicator_id=data["indicators"][0].id,
        user_id=user.id,
        type=EvidenceType.COMMENT,
        content="Protected evidence",
    )

    db_session.add(evidence)
    db_session.commit()

    evidence_id = evidence.id
    evaluation_id = evaluation.id
    user_id = user.id

    if invalid_access == "nonexistent_evaluation":
        evaluation_id = -1
    else:
        user_id = -1

    service = EvidenceService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.delete_evidence(
            evaluation_id=evaluation_id,
            evidence_id=evidence_id,
            user_id=user_id,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Evaluation not found"

    saved_evidence = db_session.get(
        EvaluationEvidence,
        evidence_id,
    )

    assert saved_evidence is not None
    assert saved_evidence.content == "Protected evidence"


@pytest.mark.parametrize(
    "invalid_evidence",
    ["nonexistent", "another_evaluation"],
)
def test_reject_delete_evidence_from_invalid_evaluation(
    db_session,
    invalid_evidence,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]

    evidence = EvaluationEvidence(
        evaluation_id=evaluation.id,
        indicator_id=data["indicators"][0].id,
        user_id=user.id,
        type=EvidenceType.COMMENT,
        content="Evidence that must be preserved",
    )

    db_session.add(evidence)
    db_session.commit()

    evidence_id = evidence.id

    if invalid_evidence == "nonexistent":
        evidence_id = -1
    else:
        other_methodology = Methodology(
            name="Other evidence test methodology",
            version="TEST-EVIDENCE-2",
        )

        db_session.add(other_methodology)
        db_session.flush()

        other_evaluation = Evaluation(
            user_id=user.id,
            company_id=data["company"].id,
            methodology_id=other_methodology.id,
            status=EvaluationStatus.DRAFT,
        )

        db_session.add(other_evaluation)
        db_session.commit()

        evaluation = other_evaluation

    service = EvidenceService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.delete_evidence(
            evaluation_id=evaluation.id,
            evidence_id=evidence_id,
            user_id=user.id,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Evidence not found"

    preserved_evidence = db_session.get(
        EvaluationEvidence,
        evidence.id,
    )

    assert preserved_evidence is not None
    assert preserved_evidence.content == "Evidence that must be preserved"


def test_reject_delete_evidence_in_completed_evaluation(db_session):
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
    db_session.commit()

    evidence_id = evidence.id

    service = EvidenceService(db_session)

    with pytest.raises(HTTPException) as exc_info:
        service.delete_evidence(
            evaluation_id=evaluation.id,
            evidence_id=evidence_id,
            user_id=user.id,
        )

    assert exc_info.value.status_code == 409
    assert (
        exc_info.value.detail
        == "Cannot modify evidence of a completed evaluation"
    )

    preserved_evidence = db_session.get(
        EvaluationEvidence,
        evidence_id,
    )

    assert preserved_evidence is not None
    assert preserved_evidence.content == (
        "Evidence from completed evaluation"
    )


def test_delete_file_evidence_removes_record_and_file(
    db_session,
    tmp_path,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    user = data["user"]
    indicator = data["indicators"][0]

    storage = EvidenceStorageService(
        storage_path=tmp_path,
    )

    content = create_valid_pdf()

    storage_key = storage.save_file(
        "document.pdf",
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
        original_filename="document.pdf",
        mime_type="application/pdf",
        file_size=len(content),
    )

    db_session.add(evidence)
    db_session.commit()

    evidence_id = evidence.id
    file_path = storage.get_file(storage_key)

    assert file_path.exists()

    service = EvidenceService(db_session)

    service.delete_evidence(
        evaluation_id=evaluation.id,
        evidence_id=evidence_id,
        user_id=user.id,
        storage=storage,
    )

    assert db_session.get(
        EvaluationEvidence,
        evidence_id,
    ) is None

    assert not file_path.exists()


@pytest.mark.anyio
async def test_create_file_evidence(db_session, tmp_path):
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

    storage = EvidenceStorageService(
        storage_path=tmp_path,
    )

    content = create_valid_pdf()

    upload = UploadFile(
        file=BytesIO(content),
        filename="evidencia.pdf",
        headers=Headers({
            "content-type": "application/pdf",
        }),
    )

    service = EvidenceService(db_session)

    try:
        evidence = await service.create_file_evidence(
            evaluation_id=evaluation.id,
            indicator_id=indicator.id,
            user_id=user.id,
            upload=upload,
            storage=storage,
        )

        assert evidence.id is not None
        assert evidence.type == EvidenceType.FILE
        assert evidence.content is None
        assert evidence.original_filename == "evidencia.pdf"
        assert evidence.mime_type == "application/pdf"
        assert evidence.file_size == len(content)
        assert evidence.storage_key is not None

        file_path = storage.get_file(evidence.storage_key)

        assert file_path.read_bytes() == content

        saved_evidence = db_session.get(
            EvaluationEvidence,
            evidence.id,
        )

        assert saved_evidence is not None

    finally:
        await upload.close()


@pytest.mark.anyio
async def test_create_file_evidence_rejects_other_user(
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

    upload = UploadFile(
        file=BytesIO(create_valid_pdf()),
        filename="evidencia.pdf",
        headers=Headers({
            "content-type": "application/pdf",
        }),
    )

    try:
        with pytest.raises(HTTPException) as exc_info:
            await EvidenceService(
                db_session
            ).create_file_evidence(
                evaluation_id=evaluation.id,
                indicator_id=indicator.id,
                user_id=user.id + 99999,
                upload=upload,
                storage=storage,
            )

        assert exc_info.value.status_code == 404
        assert list(tmp_path.iterdir()) == []

        evidence_count = (
            db_session.query(EvaluationEvidence)
            .filter(
                EvaluationEvidence.evaluation_id
                == evaluation.id,
            )
            .count()
        )

        assert evidence_count == 0

    finally:
        await upload.close()


@pytest.mark.anyio
async def test_create_file_evidence_rejects_completed_evaluation(
    db_session,
    tmp_path,
):
    data = create_evidence_data(db_session)

    evaluation = data["evaluation"]
    indicator = data["indicators"][0]
    user = data["user"]

    evaluation.status = EvaluationStatus.COMPLETED
    db_session.flush()

    storage = EvidenceStorageService(
        storage_path=tmp_path,
    )

    upload = UploadFile(
        file=BytesIO(create_valid_pdf()),
        filename="evidencia.pdf",
        headers=Headers({
            "content-type": "application/pdf",
        }),
    )

    try:
        with pytest.raises(HTTPException) as exc_info:
            await EvidenceService(
                db_session
            ).create_file_evidence(
                evaluation_id=evaluation.id,
                indicator_id=indicator.id,
                user_id=user.id,
                upload=upload,
                storage=storage,
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Cannot modify evidence of a completed evaluation"
        )

        assert list(tmp_path.iterdir()) == []

        evidence_count = (
            db_session.query(EvaluationEvidence)
            .filter(
                EvaluationEvidence.evaluation_id == evaluation.id,
            )
            .count()
        )

        assert evidence_count == 0

    finally:
        await upload.close()


@pytest.mark.anyio
async def test_create_file_evidence_rejects_missing_response(
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

    upload = UploadFile(
        file=BytesIO(create_valid_pdf()),
        filename="evidencia.pdf",
        headers=Headers({
            "content-type": "application/pdf",
        }),
    )

    try:
        with pytest.raises(HTTPException) as exc_info:
            await EvidenceService(db_session).create_file_evidence(
                evaluation_id=evaluation.id,
                indicator_id=indicator.id,
                user_id=user.id,
                upload=upload,
                storage=storage,
            )

        assert exc_info.value.status_code == 422
        assert exc_info.value.detail == (
            "Indicator has no saved response in this evaluation"
        )

        assert list(tmp_path.iterdir()) == []

        evidence_count = (
            db_session.query(EvaluationEvidence)
            .filter(
                EvaluationEvidence.evaluation_id == evaluation.id,
            )
            .count()
        )

        assert evidence_count == 0

    finally:
        await upload.close()


@pytest.mark.anyio
async def test_create_file_evidence_rejects_evidence_limit(
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

    for index in range(5):
        db_session.add(
            EvaluationEvidence(
                evaluation_id=evaluation.id,
                indicator_id=indicator.id,
                user_id=user.id,
                type=EvidenceType.COMMENT,
                content=f"Evidencia inicial {index + 1}",
            )
        )

    db_session.commit()

    storage = EvidenceStorageService(
        storage_path=tmp_path,
    )

    upload = UploadFile(
        file=BytesIO(create_valid_pdf()),
        filename="evidencia.pdf",
        headers=Headers({
            "content-type": "application/pdf",
        }),
    )

    try:
        with pytest.raises(HTTPException) as exc_info:
            await EvidenceService(db_session).create_file_evidence(
                evaluation_id=evaluation.id,
                indicator_id=indicator.id,
                user_id=user.id,
                upload=upload,
                storage=storage,
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Maximum of 5 evidences per indicator reached"
        )

        assert list(tmp_path.iterdir()) == []

        evidence_count = (
            db_session.query(EvaluationEvidence)
            .filter(
                EvaluationEvidence.evaluation_id == evaluation.id,
                EvaluationEvidence.indicator_id == indicator.id,
            )
            .count()
        )

        assert evidence_count == 5

    finally:
        await upload.close()


@pytest.mark.anyio
async def test_create_file_evidence_cleans_file_on_commit_failure(
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

    upload = UploadFile(
        file=BytesIO(create_valid_pdf()),
        filename="evidencia.pdf",
        headers=Headers({
            "content-type": "application/pdf",
        }),
    )

    service = EvidenceService(db_session)

    try:
        with patch.object(
            db_session,
            "commit",
            side_effect=SQLAlchemyError(
                "Simulated database commit failure"
            ),
        ):
            with pytest.raises(SQLAlchemyError):
                await service.create_file_evidence(
                    evaluation_id=evaluation.id,
                    indicator_id=indicator.id,
                    user_id=user.id,
                    upload=upload,
                    storage=storage,
                )

        assert list(tmp_path.iterdir()) == []

        evidence_count = (
            db_session.query(EvaluationEvidence)
            .filter(
                EvaluationEvidence.evaluation_id == evaluation.id,
                EvaluationEvidence.indicator_id == indicator.id,
            )
            .count()
        )

        assert evidence_count == 0

    finally:
        await upload.close()


@pytest.mark.anyio
async def test_create_file_evidence_preserves_file_on_refresh_failure(
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

    content = create_valid_pdf()

    upload = UploadFile(
        file=BytesIO(content),
        filename="evidencia.pdf",
        headers=Headers({
            "content-type": "application/pdf",
        }),
    )

    service = EvidenceService(db_session)

    try:
        with patch.object(
            db_session,
            "refresh",
            side_effect=SQLAlchemyError(
                "Simulated refresh failure"
            ),
        ):
            with pytest.raises(SQLAlchemyError):
                await service.create_file_evidence(
                    evaluation_id=evaluation.id,
                    indicator_id=indicator.id,
                    user_id=user.id,
                    upload=upload,
                    storage=storage,
                )

        saved_evidence = (
            db_session.query(EvaluationEvidence)
            .filter(
                EvaluationEvidence.evaluation_id == evaluation.id,
                EvaluationEvidence.indicator_id == indicator.id,
                EvaluationEvidence.type == EvidenceType.FILE,
            )
            .one()
        )

        assert saved_evidence.storage_key is not None

        file_path = storage.get_file(
            saved_evidence.storage_key
        )

        assert file_path.read_bytes() == content

    finally:
        await upload.close()
