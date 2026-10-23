from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

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
    ) -> Evaluation:
        evaluation = (
            self.db.query(Evaluation)
            .filter(Evaluation.id == evaluation_id)
            .first()
        )

        if evaluation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Evaluation not found",
            )

        if evaluation.user_id != user_id:
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
            evaluation = (
                self.db.query(Evaluation)
                .filter(
                    Evaluation.id == evaluation_id,
                    Evaluation.user_id == user_id,
                )
                .with_for_update()
                .first()
            )

            if evaluation is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Evaluation not found",
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
    ) -> None:
        try:
            evaluation = (
                self.db.query(Evaluation)
                .filter(
                    Evaluation.id == evaluation_id,
                    Evaluation.user_id == user_id,
                )
                .with_for_update()
                .first()
            )

            if evaluation is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Evaluation not found",
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
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="File evidence deletion requires storage integration",
                )

            self.db.delete(evidence)
            self.db.commit()

        except HTTPException:
            self.db.rollback()
            raise

        except SQLAlchemyError:
            self.db.rollback()
            raise
