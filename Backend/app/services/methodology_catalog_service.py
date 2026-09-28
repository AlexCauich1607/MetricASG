from fastapi import HTTPException

from app.models.ambit_model import Ambit
from app.models.feedback_ambit_model import FeedbackAmbit
from app.models.indicator_answer_model import IndicatorAnswer
from app.models.indicator_model import Indicator
from app.models.maturity_level_model import MaturityLevel
from app.models.maturity_level_score_range_model import MaturityLevelScoreRange
from app.models.methodology_model import Methodology, MethodologyStatus
from app.services.base_service import BaseService


class MethodologyCatalogService(BaseService):
    def create(self, data: dict):
        methodology_id = self._methodology_id_from_data(data)
        self._ensure_draft(methodology_id)

        return super().create(data)

    def update(self, item_id: int, data: dict):
        obj = self.read(item_id)

        if not obj:
            return None

        current_methodology_id = self._methodology_id_from_object(obj)
        self._ensure_draft(current_methodology_id)

        candidate_data = self._build_candidate_data(obj, data)
        target_methodology_id = self._methodology_id_from_data(
            candidate_data
        )

        if target_methodology_id != current_methodology_id:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Catalog records cannot be moved between "
                    "methodologies"
                ),
            )

        return super().update(item_id, data)

    def delete(self, item_id: int):
        obj = self.read(item_id)

        if not obj:
            return None

        methodology_id = self._methodology_id_from_object(obj)
        self._ensure_draft(methodology_id)

        return super().delete(item_id)

    def _ensure_draft(self, methodology_id: int):
        methodology = (
            self.db.query(Methodology)
            .filter(Methodology.id == methodology_id)
            .first()
        )

        if not methodology:
            raise HTTPException(
                status_code=404,
                detail="Methodology not found",
            )

        if methodology.status != MethodologyStatus.DRAFT:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Only catalogs from draft methodologies "
                    "can be modified"
                ),
            )

    def _methodology_id_from_object(self, obj):
        if isinstance(obj, (Ambit, MaturityLevel)):
            return obj.methodology_id

        if isinstance(obj, Indicator):
            ambit = self._get_ambit(obj.ambit_id)
            return ambit.methodology_id

        if isinstance(obj, IndicatorAnswer):
            return self._validate_answer_references(
                obj.indicator_id,
                obj.maturity_level_id,
            )

        if isinstance(obj, FeedbackAmbit):
            return self._validate_feedback_references(
                obj.ambit_id,
                obj.maturity_level_id,
            )

        if isinstance(obj, MaturityLevelScoreRange):
            maturity = self._get_maturity_level(
                obj.maturity_level_id
            )
            return maturity.methodology_id

        raise HTTPException(
            status_code=500,
            detail="Unsupported methodology catalog model",
        )

    def _methodology_id_from_data(self, data: dict):
        if self.model in (Ambit, MaturityLevel):
            methodology_id = data.get("methodology_id")

            if methodology_id is None:
                raise HTTPException(
                    status_code=422,
                    detail="methodology_id is required",
                )

            return methodology_id

        if self.model is Indicator:
            ambit = self._get_ambit(data.get("ambit_id"))
            return ambit.methodology_id

        if self.model is IndicatorAnswer:
            return self._validate_answer_references(
                data.get("indicator_id"),
                data.get("maturity_level_id"),
            )

        if self.model is FeedbackAmbit:
            return self._validate_feedback_references(
                data.get("ambit_id"),
                data.get("maturity_level_id"),
            )

        if self.model is MaturityLevelScoreRange:
            maturity = self._get_maturity_level(
                data.get("maturity_level_id")
            )
            return maturity.methodology_id

        raise HTTPException(
            status_code=500,
            detail="Unsupported methodology catalog model",
        )

    def _build_candidate_data(self, obj, data: dict):
        if isinstance(obj, Ambit):
            current = {
                "methodology_id": obj.methodology_id,
            }

        elif isinstance(obj, MaturityLevel):
            current = {
                "methodology_id": obj.methodology_id,
            }

        elif isinstance(obj, Indicator):
            current = {
                "ambit_id": obj.ambit_id,
            }

        elif isinstance(obj, IndicatorAnswer):
            current = {
                "indicator_id": obj.indicator_id,
                "maturity_level_id": obj.maturity_level_id,
            }

        elif isinstance(obj, FeedbackAmbit):
            current = {
                "ambit_id": obj.ambit_id,
                "maturity_level_id": obj.maturity_level_id,
            }

        elif isinstance(obj, MaturityLevelScoreRange):
            current = {
                "maturity_level_id": obj.maturity_level_id,
            }

        else:
            current = {}

        current.update(data)
        return current

    def _get_ambit(self, ambit_id: int):
        if ambit_id is None:
            raise HTTPException(
                status_code=422,
                detail="ambit_id is required",
            )

        ambit = (
            self.db.query(Ambit)
            .filter(Ambit.id == ambit_id)
            .first()
        )

        if not ambit:
            raise HTTPException(404, "Ambit not found")

        return ambit

    def _get_indicator(self, indicator_id: int):
        if indicator_id is None:
            raise HTTPException(
                status_code=422,
                detail="indicator_id is required",
            )

        indicator = (
            self.db.query(Indicator)
            .filter(Indicator.id == indicator_id)
            .first()
        )

        if not indicator:
            raise HTTPException(404, "Indicator not found")

        return indicator

    def _get_maturity_level(self, maturity_level_id: int):
        if maturity_level_id is None:
            raise HTTPException(
                status_code=422,
                detail="maturity_level_id is required",
            )

        maturity = (
            self.db.query(MaturityLevel)
            .filter(MaturityLevel.id == maturity_level_id)
            .first()
        )

        if not maturity:
            raise HTTPException(
                status_code=404,
                detail="Maturity level not found",
            )

        return maturity

    def _validate_answer_references(
        self,
        indicator_id: int,
        maturity_level_id: int,
    ):
        indicator = self._get_indicator(indicator_id)
        ambit = self._get_ambit(indicator.ambit_id)
        maturity = self._get_maturity_level(maturity_level_id)

        if ambit.methodology_id != maturity.methodology_id:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Indicator and maturity level belong to "
                    "different methodologies"
                ),
            )

        return ambit.methodology_id

    def _validate_feedback_references(
        self,
        ambit_id: int,
        maturity_level_id: int,
    ):
        ambit = self._get_ambit(ambit_id)
        maturity = self._get_maturity_level(maturity_level_id)

        if ambit.methodology_id != maturity.methodology_id:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Ambit and maturity level belong to "
                    "different methodologies"
                ),
            )

        return ambit.methodology_id