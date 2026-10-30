import app.models

from app.database.database import SessionLocal
from app.services.evidence_storage_service import EvidenceStorageService
from app.services.evidence_reconciliation_service import (
    EvidenceReconciliationService,
)

def main():
    storage = EvidenceStorageService()

    with SessionLocal() as db:
        reconciliation = EvidenceReconciliationService(
            db=db,
            storage=storage,
        )

        orphan_files = reconciliation.find_orphan_files()

    print("Evidence storage reconciliation")
    print(f"Storage directory: {storage.storage_path}")
    print(f"Potential orphan files: {len(orphan_files)}")

    for file_path in orphan_files:
        print(f" - {file_path.name}")

    print("Diagnostic completed. No files were deleted.")


if __name__ == "__main__":
    main()
