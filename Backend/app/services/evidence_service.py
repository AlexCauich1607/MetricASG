from fastapi import HTTPException, status, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.services.evidence_storage_service import EvidenceStorageService

from app.models.evaluation_evidence_request import EvidenceCreateRequest
from app.models.evaluation_evidence_model import (
    EvaluationEvidence,
    EvidenceType,
)
from app.models.ambit_model import Ambit
from app.models.indicator_model import Indicator
from app.models.evaluation_indicator_response_model import (
    EvaluationIndicatorResponse,
)
from app.core.company_permissions import require_company_role
from app.core.roles import CompanyRole
from app.models.user_model import User
from app.models.company_model import Company
from app.models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)

from app.models.evaluation_model import (
    Evaluation,
    EvaluationStatus,
)


class EvidenceService:
    def __init__(self, db: Session):
        self.db = db

    def get_evaluation_or_error(
        self,
        evaluation_id: int,
        user_id: int,
        *,
        write: bool = False,
        lock: bool = False,
    ) -> Evaluation:

        query = (
            self.db.query(Evaluation)
            .join(
                CompanyMembership,
                CompanyMembership.company_id == Evaluation.company_id,
            )
            .join(
                Company,
                Company.id == Evaluation.company_id,
            )
            .filter(
                Evaluation.id == evaluation_id,
                CompanyMembership.user_id == user_id,
                CompanyMembership.status
                == CompanyMembershipStatus.ACTIVE,
                Company.active.is_(True),
            )
        )

        if lock:
            query = query.with_for_update(of=Evaluation)

        evaluation = query.first()

        if evaluation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Evaluation not found",
            )

        user = self.db.get(User, user_id)

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Active company membership required",
            )

        # Las operaciones de escritura y el acceso a borradores
        # continúan restringidos al autor de la evaluación.
        if write or evaluation.status == EvaluationStatus.DRAFT:

            if evaluation.user_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Evaluation not found",
                )

            require_company_role(
                self.db,
                user,
                evaluation.company_id,
                CompanyRole.COMPANY_ADMIN,
                CompanyRole.ASG_MANAGER,
                CompanyRole.COLLABORATOR,
            )

        elif evaluation.status == EvaluationStatus.COMPLETED:

            require_company_role(
                self.db,
                user,
                evaluation.company_id,
                *tuple(CompanyRole),
            )

        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Evaluation not found",
            )

        return evaluation

    def validate_evaluation_editable(
        self,
        evaluation: Evaluation,
    ) -> None:
        if evaluation.status != EvaluationStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot modify evidence of a completed evaluation",
            )


    def validate_indicator_response(
        self,
        evaluation: Evaluation,
        indicator_id: int,
    ) -> None:
        indicator = (
            self.db.query(Indicator)
            .join(Ambit, Indicator.ambit_id == Ambit.id)
            .filter(
                Indicator.id == indicator_id,
                Ambit.methodology_id == evaluation.methodology_id,
            )
            .first()
        )

        if indicator is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Indicator does not belong to evaluation methodology",
            )

        response = (
            self.db.query(EvaluationIndicatorResponse)
            .filter(
                EvaluationIndicatorResponse.evaluation_id == evaluation.id,
                EvaluationIndicatorResponse.indicator_id == indicator_id,
            )
            .first()
        )

        if response is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Indicator has no saved response in this evaluation",
            )


    def validate_evidence_limit(
        self,
        evaluation_id: int,
        indicator_id: int,
    ) -> None:
        evidence_count = (
            self.db.query(EvaluationEvidence)
            .filter(
                EvaluationEvidence.evaluation_id == evaluation_id,
                EvaluationEvidence.indicator_id == indicator_id,
            )
            .count()
        )

        if evidence_count >= 5:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Maximum of 5 evidences per indicator reached",
            )


    def create_evidence(
        self,
        evaluation_id: int,
        user_id: int,
        payload: EvidenceCreateRequest,
    ) -> EvaluationEvidence:
        try:
            evaluation = self.get_evaluation_or_error(
                evaluation_id=evaluation_id,
                user_id=user_id,
                write=True,
                lock=True,
            )

            self.validate_evaluation_editable(evaluation)

            self.validate_indicator_response(
                evaluation,
                payload.indicator_id,
            )

            self.validate_evidence_limit(
                evaluation.id,
                payload.indicator_id,
            )

            evidence = EvaluationEvidence(
                evaluation_id=evaluation.id,
                indicator_id=payload.indicator_id,
                user_id=user_id,
                type=payload.type.value,
                content=payload.content,
            )

            self.db.add(evidence)
            self.db.commit()
            self.db.refresh(evidence)

            return evidence

        except HTTPException:
            self.db.rollback()
            raise

        except SQLAlchemyError:
            self.db.rollback()
            raise


    async def create_file_evidence(
        self,
        evaluation_id: int,
        indicator_id: int,
        user_id: int,
        upload: UploadFile,
        storage: EvidenceStorageService,
    ) -> EvaluationEvidence:
        storage_key = None

        try:
            evaluation = self.get_evaluation_or_error(
                evaluation_id=evaluation_id,
                user_id=user_id,
                write=True,
                lock=True,
            )

            self.validate_evaluation_editable(evaluation)

            self.validate_indicator_response(
                evaluation,
                indicator_id,
            )

            self.validate_evidence_limit(
                evaluation.id,
                indicator_id,
            )

            storage_key, file_size = await storage.save_upload_file(
                upload
            )

            evidence = EvaluationEvidence(
                evaluation_id=evaluation.id,
                indicator_id=indicator_id,
                user_id=user_id,
                type=EvidenceType.FILE,
                content=None,
                storage_key=storage_key,
                original_filename=upload.filename,
                mime_type=upload.content_type,
                file_size=file_size,
            )

            self.db.add(evidence)
            self.db.commit()

        except BaseException:
            self.db.rollback()

            if storage_key is not None:
                try:
                    storage.delete_file(storage_key)
                except FileNotFoundError:
                    pass

            raise

        # El commit ya finalizó correctamente.
        # A partir de aquí no debemos eliminar el archivo.
        self.db.refresh(evidence)

        return evidence



    def list_evidences(
        self,
        evaluation_id: int,
        user_id: int,
        indicator_id: int | None = None,
    ) -> list[EvaluationEvidence]:
        self.get_evaluation_or_error(
            evaluation_id,
            user_id,
        )

        query = (
            self.db.query(EvaluationEvidence)
            .filter(
                EvaluationEvidence.evaluation_id == evaluation_id,
            )
        )

        if indicator_id is not None:
            query = query.filter(
                EvaluationEvidence.indicator_id == indicator_id,
            )

        return query.order_by(
            EvaluationEvidence.created_at.asc(),
            EvaluationEvidence.id.asc(),
        ).all()

    def get_evidence_or_error(
        self,
        evaluation_id: int,
        evidence_id: int,
        user_id: int,
    ) -> EvaluationEvidence:
        self.get_evaluation_or_error(
            evaluation_id,
            user_id,
        )

        evidence = (
            self.db.query(EvaluationEvidence)
            .filter(
                EvaluationEvidence.id == evidence_id,
                EvaluationEvidence.evaluation_id == evaluation_id,
            )
            .first()
        )

        if evidence is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Evidence not found",
            )

        return evidence



    def delete_evidence(
        self,
        evaluation_id: int,
        evidence_id: int,
        user_id: int,
        storage: EvidenceStorageService | None = None,
    ) -> None:
        storage_key = None

        try:
            evaluation = self.get_evaluation_or_error(
                evaluation_id=evaluation_id,
                user_id=user_id,
                write=True,
                lock=True,
            )

            self.validate_evaluation_editable(evaluation)

            evidence = (
                self.db.query(EvaluationEvidence)
                .filter(
                    EvaluationEvidence.id == evidence_id,
                    EvaluationEvidence.evaluation_id == evaluation.id,
                )
                .first()
            )

            if evidence is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Evidence not found",
                )

            if evidence.type == EvidenceType.FILE:
                if storage is None:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Evidence storage is not configured",
                    )

                storage_key = evidence.storage_key

                if not storage_key:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="File evidence has no storage reference",
                    )

            self.db.delete(evidence)
            self.db.commit()

        except BaseException:
            self.db.rollback()
            raise

        if storage_key is not None:
            try:
                storage.delete_file(storage_key)
            except FileNotFoundError:
                pass
