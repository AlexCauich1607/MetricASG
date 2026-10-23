
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.evaluation_evidence_request import (
    EvidenceCreateRequest,
    EvidenceResponse,
)
from app.models.user_model import User
from app.services.evidence_service import EvidenceService
from app.services.token_service import get_current_user


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

        @self.router.delete(
            "/{evidence_id}",
            status_code=status.HTTP_204_NO_CONTENT,
        )
        def delete_evidence(
            evaluation_id: int,
            evidence_id: int,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db),
        ):
            EvidenceService(db).delete_evidence(
                evaluation_id=evaluation_id,
                evidence_id=evidence_id,
                user_id=current_user.id,
            )
