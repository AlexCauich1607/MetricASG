
import os
import time
import uuid

from app.models.evaluation_evidence_model import (
    EvaluationEvidence,
    EvidenceType,
)
from app.services.evidence_storage_service import (
    EvidenceStorageService,
)
from app.models.evaluation_model import Evaluation, EvaluationStatus
from app.services.evidence_reconciliation_service import (
    EvidenceReconciliationService,
)
from tests.test_evaluation import create_evaluation_data
from tests.test_evidence_storage_service import create_valid_pdf


def test_reconciliation_detects_orphan_file(
    db_session,
    tmp_path,
):
    storage = EvidenceStorageService(
        storage_path=tmp_path,
    )

    storage_key = storage.save_file(
        "orphan.pdf",
        create_valid_pdf(),
        "application/pdf",
    )

    file_path = storage.get_file(storage_key)

    old_timestamp = time.time() - (48 * 60 * 60)
    os.utime(file_path, (old_timestamp, old_timestamp))

    reconciliation = EvidenceReconciliationService(
        db_session,
        storage,
    )

    orphan_files = reconciliation.find_orphan_files()

    assert orphan_files == [file_path]
    assert file_path.exists()


def test_reconciliation_ignores_recent_file(
    db_session,
    tmp_path,
):
    storage = EvidenceStorageService(
        storage_path=tmp_path,
    )

    storage_key = storage.save_file(
        "recent.pdf",
        create_valid_pdf(),
        "application/pdf",
    )

    file_path = storage.get_file(storage_key)

    reconciliation = EvidenceReconciliationService(
        db_session,
        storage,
    )

    assert reconciliation.find_orphan_files() == []
    assert file_path.exists()


def test_reconciliation_ignores_referenced_file(
    db_session,
    tmp_path,
):
    data = create_evaluation_data(db_session)

    user = data["user"]
    indicator = data["indicators"][0]
    methodology = data["methodology"]

    evaluation = Evaluation(
        user_id=user.id,
        methodology_id=methodology.id,
        status=EvaluationStatus.DRAFT,
    )

    db_session.add(evaluation)
    db_session.flush()

    storage = EvidenceStorageService(
        storage_path=tmp_path,
    )

    content = create_valid_pdf()

    storage_key = storage.save_file(
        "referenced.pdf",
        content,
        "application/pdf",
    )

    file_path = storage.get_file(storage_key)

    old_timestamp = time.time() - (48 * 60 * 60)
    os.utime(file_path, (old_timestamp, old_timestamp))

    evidence = EvaluationEvidence(
        evaluation_id=evaluation.id,
        indicator_id=indicator.id,
        user_id=user.id,
        type=EvidenceType.FILE,
        content=None,
        storage_key=storage_key,
        original_filename="referenced.pdf",
        mime_type="application/pdf",
        file_size=len(content),
    )

    db_session.add(evidence)
    db_session.commit()

    reconciliation = EvidenceReconciliationService(
        db_session,
        storage,
    )

    assert reconciliation.find_orphan_files() == []
    assert file_path.exists()


def test_reconciliation_ignores_invalid_filename(
    db_session,
    tmp_path,
):
    invalid_file = tmp_path / "documento.pdf"
    invalid_file.write_bytes(create_valid_pdf())

    old_timestamp = time.time() - (48 * 60 * 60)
    os.utime(
        invalid_file,
        (old_timestamp, old_timestamp),
    )

    storage = EvidenceStorageService(
        storage_path=tmp_path,
    )

    reconciliation = EvidenceReconciliationService(
        db_session,
        storage,
    )

    assert reconciliation.find_orphan_files() == []
    assert invalid_file.exists()


def test_reconciliation_ignores_symbolic_links(
    db_session,
    tmp_path,
):
    external_file = tmp_path.parent / (
        f"{uuid.uuid4().hex}.pdf"
    )

    external_file.write_bytes(create_valid_pdf())

    storage = EvidenceStorageService(
        storage_path=tmp_path,
    )

    symbolic_link = tmp_path / (
        f"{uuid.uuid4().hex}.pdf"
    )

    try:
        symbolic_link.symlink_to(external_file)

        reconciliation = EvidenceReconciliationService(
            db_session,
            storage,
        )

        assert reconciliation.find_orphan_files() == []
        assert external_file.exists()

    finally:
        symbolic_link.unlink(missing_ok=True)
        external_file.unlink(missing_ok=True)


def test_reconciliation_handles_missing_directory(
    db_session,
    tmp_path,
):
    storage = EvidenceStorageService(
        storage_path=tmp_path / "nonexistent",
    )

    reconciliation = EvidenceReconciliationService(
        db_session,
        storage,
    )

    assert reconciliation.find_orphan_files() == []
