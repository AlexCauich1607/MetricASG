from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from urllib.parse import quote

from app.models.evaluation_evidence_model import EvidenceType
from sqlalchemy.orm import Session
from app.services.evidence_storage_service import EvidenceStorageService
from app.database.database import get_db
from app.models.evaluation_evidence_request import (
    EvidenceCreateRequest,
    EvidenceResponse,
)
from app.models.user_model import User
from app.services.evidence_service import EvidenceService
from app.services.token_service import get_current_user

def get_evidence_storage_service() -> EvidenceStorageService:
    return EvidenceStorageService()

def stream_evidence_file(file):
    try:
        while chunk := file.read(64 * 1024):
            yield chunk
    finally:
        file.close()

class EvidenceController:
    def __init__(self):
        self.router = APIRouter(
            prefix="/api/evaluations/{evaluation_id}/evidences",
            tags=["Evaluation Evidences"],
        )

        @self.router.post(
            "",
            response_model=EvidenceResponse,
            status_code=status.HTTP_201_CREATED,
        )
        def create_evidence(
            evaluation_id: int,
            payload: EvidenceCreateRequest,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return EvidenceService(db).create_evidence(
                evaluation_id=evaluation_id,
                user_id=current_user.id,
                payload=payload,
            )

        @self.router.post(
            "/upload",
            response_model=EvidenceResponse,
            status_code=status.HTTP_201_CREATED,
        )
        async def upload_evidence(
            evaluation_id: int,
            indicator_id: int = Form(gt=0),
            file: UploadFile = File(),
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
            storage: EvidenceStorageService = Depends(
                get_evidence_storage_service
            ),
        ):
            try:
                return await EvidenceService(db).create_file_evidence(
                    evaluation_id=evaluation_id,
                    indicator_id=indicator_id,
                    user_id=current_user.id,
                    upload=file,
                    storage=storage,
                )

            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=str(exc),
                ) from exc

        @self.router.get(
            "",
            response_model=list[EvidenceResponse],
        )
        def list_evidences(
            evaluation_id: int,
            indicator_id: int | None = Query(default=None, gt=0),
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return EvidenceService(db).list_evidences(
                evaluation_id=evaluation_id,
                user_id=current_user.id,
                indicator_id=indicator_id,
            )

        @self.router.get(
            "/{evidence_id}",
            response_model=EvidenceResponse,
        )
        def get_evidence(
            evaluation_id: int,
            evidence_id: int,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            return EvidenceService(db).get_evidence_or_error(
                evaluation_id=evaluation_id,
                evidence_id=evidence_id,
                user_id=current_user.id,
            )

        @self.router.get(
            "/{evidence_id}/download",
        )
        def download_evidence(
            evaluation_id: int,
            evidence_id: int,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
            storage: EvidenceStorageService = Depends(
                get_evidence_storage_service
            ),
        ):
            evidence = EvidenceService(db).get_evidence_or_error(
                evaluation_id=evaluation_id,
                evidence_id=evidence_id,
                user_id=current_user.id,
            )

            if (
                evidence.type != EvidenceType.FILE
                or not evidence.storage_key
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Evidence does not contain a file",
                )

            try:
                file = storage.open_file(evidence.storage_key)
            except FileNotFoundError as exc:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Evidence file not found",
                ) from exc

            filename = evidence.original_filename or "evidence"
            encoded_filename = quote(filename, safe="")

            return StreamingResponse(
                stream_evidence_file(file),
                media_type="application/octet-stream",
                headers={
                    "Content-Disposition": (
                        "attachment; "
                        f"filename*=UTF-8''{encoded_filename}"
                    ),
                    "X-Content-Type-Options": "nosniff",
                    "Cache-Control": "private, no-store",
                },
            )

        @self.router.delete(
            "/{evidence_id}",
            status_code=status.HTTP_204_NO_CONTENT,
        )
        def delete_evidence(
            evaluation_id: int,
            evidence_id: int,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
            storage: EvidenceStorageService = Depends(
                get_evidence_storage_service
            ),
        ):
            EvidenceService(db).delete_evidence(
                evaluation_id=evaluation_id,
                evidence_id=evidence_id,
                user_id=current_user.id,
                storage=storage,
            )
