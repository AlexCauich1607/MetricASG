
import stat
import time
from datetime import timedelta
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.evaluation_evidence_model import (
    EvaluationEvidence,
)
from app.services.evidence_storage_service import (
    EvidenceStorageService,
)


class EvidenceReconciliationService:
    MIN_FILE_AGE = timedelta(hours=24)

    def __init__(
        self,
        db: Session,
        storage: EvidenceStorageService,
    ):
        self.db = db
        self.storage = storage

    def find_orphan_files(self) -> list[Path]:
        referenced_keys = {
            storage_key
            for (storage_key,) in (
                self.db.query(EvaluationEvidence.storage_key)
                .filter(
                    EvaluationEvidence.storage_key.isnot(None)
                )
                .all()
            )
        }

        if not self.storage.storage_path.exists():
            return []

        orphan_files = []
        now = time.time()

        for file_path in self.storage.storage_path.iterdir():
            file_stat = file_path.lstat()

            if not stat.S_ISREG(file_stat.st_mode):
                continue

            if not self.storage.STORAGE_KEY_PATTERN.fullmatch(
                file_path.name
            ):
                continue

            file_age = now - file_stat.st_mtime

            if file_age < self.MIN_FILE_AGE.total_seconds():
                continue

            if file_path.name not in referenced_keys:
                orphan_files.append(file_path)

        return sorted(orphan_files)
