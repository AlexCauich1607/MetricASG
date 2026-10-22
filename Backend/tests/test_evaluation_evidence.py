
from sqlalchemy import select

import pytest

from sqlalchemy.exc import IntegrityError, StatementError

from app.models.evaluation_evidence_model import (
    EvaluationEvidence,
    EvidenceType,
)
from app.models.evaluation_model import (
    Evaluation,
    EvaluationStatus,
)
from tests.test_evaluation import create_evaluation_data


def create_evidence_data(db_session):
    data = create_evaluation_data(db_session)

    evaluation = Evaluation(
        user_id=data["user"].id,
        methodology_id=data["methodology"].id,
        status=EvaluationStatus.DRAFT,
    )

    db_session.add(evaluation)
    db_session.flush()

    return {
        **data,
        "evaluation": evaluation,
    }


def test_create_comment_evidence(db_session):
    data = create_evidence_data(db_session)

    evidence = EvaluationEvidence(
        evaluation_id=data["evaluation"].id,
        indicator_id=data["indicators"][0].id,
        user_id=data["user"].id,
        type=EvidenceType.COMMENT,
        content="La empresa cuenta con una política ambiental.",
    )

    db_session.add(evidence)
    db_session.flush()

    saved_evidence = db_session.scalar(
        select(EvaluationEvidence).where(
            EvaluationEvidence.id == evidence.id
        )
    )

    assert saved_evidence is not None
    assert saved_evidence.type == EvidenceType.COMMENT
    assert saved_evidence.content == (
        "La empresa cuenta con una política ambiental."
    )
    assert saved_evidence.evaluation_id == data["evaluation"].id
    assert saved_evidence.indicator_id == data["indicators"][0].id
    assert saved_evidence.user_id == data["user"].id

def test_create_url_evidence(db_session):
    data = create_evidence_data(db_session)

    evidence = EvaluationEvidence(
        evaluation_id=data["evaluation"].id,
        indicator_id=data["indicators"][0].id,
        user_id=data["user"].id,
        type=EvidenceType.URL,
        content="https://example.com/sustainability-report",
    )

    db_session.add(evidence)
    db_session.flush()

    saved_evidence = db_session.get(
        EvaluationEvidence,
        evidence.id,
    )

    assert saved_evidence is not None
    assert saved_evidence.type == EvidenceType.URL
    assert saved_evidence.content == (
        "https://example.com/sustainability-report"
    )

    assert saved_evidence.storage_key is None
    assert saved_evidence.file_size is None

def test_create_file_evidence(db_session):
    data = create_evidence_data(db_session)

    evidence = EvaluationEvidence(
        evaluation_id=data["evaluation"].id,
        indicator_id=data["indicators"][0].id,
        user_id=data["user"].id,
        type=EvidenceType.FILE,
        storage_key="evidences/test/environmental-policy.pdf",
        original_filename="politica-ambiental.pdf",
        mime_type="application/pdf",
        file_size=204800,
    )

    db_session.add(evidence)
    db_session.flush()

    saved_evidence = db_session.get(
        EvaluationEvidence,
        evidence.id,
    )

    assert saved_evidence is not None
    assert saved_evidence.type == EvidenceType.FILE

    assert saved_evidence.storage_key == (
        "evidences/test/environmental-policy.pdf"
    )
    assert saved_evidence.original_filename == (
        "politica-ambiental.pdf"
    )
    assert saved_evidence.mime_type == "application/pdf"
    assert saved_evidence.file_size == 204800
    assert saved_evidence.content is None

def test_reject_invalid_evidence_type(db_session):
    data = create_evidence_data(db_session)

    evidence = EvaluationEvidence(
        evaluation_id=data["evaluation"].id,
        indicator_id=data["indicators"][0].id,
        user_id=data["user"].id,
        type="INVALID",
        content="Invalid evidence type",
    )

    db_session.add(evidence)

    with pytest.raises(StatementError) as exc_info:
        db_session.flush()

    assert isinstance(exc_info.value.orig, LookupError)
    assert "INVALID" in str(exc_info.value.orig)

    db_session.rollback()

@pytest.mark.parametrize(
    "invalid_field",
    [
        "evaluation_id",
        "indicator_id",
        "user_id",
    ],
)

def test_reject_nonexistent_evidence_references(
    db_session,
    invalid_field,
):
    data = create_evidence_data(db_session)

    evidence_data = {
        "evaluation_id": data["evaluation"].id,
        "indicator_id": data["indicators"][0].id,
        "user_id": data["user"].id,
        "type": EvidenceType.COMMENT,
        "content": "Test evidence",
    }

    evidence_data[invalid_field] = -1

    evidence = EvaluationEvidence(**evidence_data)

    db_session.add(evidence)

    with pytest.raises(IntegrityError) as exc_info:
        db_session.flush()

    assert exc_info.value.orig.pgcode == "23503"

    db_session.rollback()

def test_evidence_orm_relationships(db_session):
    data = create_evidence_data(db_session)

    evidence = EvaluationEvidence(
        evaluation_id=data["evaluation"].id,
        indicator_id=data["indicators"][0].id,
        user_id=data["user"].id,
        type=EvidenceType.COMMENT,
        content="Evidence relationship test",
    )

    db_session.add(evidence)
    db_session.flush()

    # Consultar las relaciones desde la base de datos.
    db_session.expire_all()

    evaluation = db_session.get(
        Evaluation,
        data["evaluation"].id,
    )

    indicator = data["indicators"][0]
    user = data["user"]

    assert len(evaluation.evidences) == 1
    assert evaluation.evidences[0].id == evidence.id

    assert len(indicator.evidences) == 1
    assert indicator.evidences[0].id == evidence.id

    assert len(user.evidences) == 1
    assert user.evidences[0].id == evidence.id