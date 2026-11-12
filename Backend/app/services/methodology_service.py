from fastapi import HTTPException

from ..models.methodology_model import Methodology, MethodologyStatus
from .audit_service import AuditService

class MethodologyService:
    def __init__(self, db):
        self.db = db

    def read_all(self):
        return (
            self.db.query(Methodology)
            .order_by(Methodology.id.asc())
            .all()
        )

    def read(self, methodology_id: int):
        return (
            self.db.query(Methodology)
            .filter(Methodology.id == methodology_id)
            .first()
        )

    def create(self, data: dict, *, actor_id: int):
        name = data.get("name")
        version = data.get("version")

        if not name or not version:
            raise HTTPException(
                status_code=422,
                detail="Name and version are required",
            )

        existing = (
            self.db.query(Methodology)
            .filter(Methodology.version == version)
            .first()
        )

        if existing:
            raise HTTPException(
                status_code=409,
                detail="Methodology version already exists",
            )

        methodology = Methodology(
            name=name,
            version=version,
            status=MethodologyStatus.DRAFT,
            is_active=False,
        )

        self.db.add(methodology)
        self.db.flush()

        AuditService.record(
            db=self.db,
            action="methodology.created",
            resource_type="methodology",
            resource_id=methodology.id,
            actor_id=actor_id,
            context={
                "version": methodology.version,
            },
        )

        self.db.commit()
        self.db.refresh(methodology)

        return methodology

    def update(
        self,
        methodology_id: int,
        data: dict,
        *,
        actor_id: int,
    ):
        methodology = self.get_or_error(methodology_id)

        if methodology.status != MethodologyStatus.DRAFT:
            raise HTTPException(
                status_code=409,
                detail="Only draft methodologies can be edited",
            )

        allowed_fields = {"name", "version"}

        invalid_fields = set(data) - allowed_fields

        if invalid_fields:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Only name and version can be updated "
                    "directly"
                ),
            )

        if "version" in data:
            existing = (
                self.db.query(Methodology)
                .filter(
                    Methodology.version == data["version"],
                    Methodology.id != methodology.id,
                )
                .first()
            )

            if existing:
                raise HTTPException(
                    status_code=409,
                    detail="Methodology version already exists",
                )

        changed_fields = [
            key
            for key, value in data.items()
            if getattr(methodology, key) != value
        ]

        for key, value in data.items():
            setattr(methodology, key, value)

        if changed_fields:
            AuditService.record(
                db=self.db,
                action="methodology.updated",
                resource_type="methodology",
                resource_id=methodology.id,
                actor_id=actor_id,
                context={
                    "changed_fields": sorted(changed_fields),
                },
            )

        self.db.commit()
        self.db.refresh(methodology)

        return methodology


    def publish(self, methodology_id: int, *, actor_id: int):
        methodology = self.get_or_error(methodology_id)

        if methodology.status != MethodologyStatus.DRAFT:
            raise HTTPException(
                status_code=409,
                detail="Only draft methodologies can be published",
            )

        methodology.status = MethodologyStatus.PUBLISHED

        AuditService.record(
            db=self.db,
            action="methodology.published",
            resource_type="methodology",
            resource_id=methodology.id,
            actor_id=actor_id,
            context={
                "status": MethodologyStatus.PUBLISHED.value,
            },
        )

        self.db.commit()
        self.db.refresh(methodology)

        return methodology


    def activate(self, methodology_id: int, *, actor_id: int):
        methodology = self.get_or_error(methodology_id)

        if methodology.status != MethodologyStatus.PUBLISHED:
            raise HTTPException(
                status_code=409,
                detail="Only published methodologies can be activated",
            )

        (
            self.db.query(Methodology)
            .filter(
                Methodology.is_active.is_(True),
                Methodology.id != methodology.id,
            )
            .update(
                {Methodology.is_active: False},
                synchronize_session=False,
            )
        )

        self.db.flush()

        methodology.is_active = True

        AuditService.record(
            db=self.db,
            action="methodology.activated",
            resource_type="methodology",
            resource_id=methodology.id,
            actor_id=actor_id,
            context={
                "is_active": True,
                "version": methodology.version,
            },
        )

        self.db.commit()
        self.db.refresh(methodology)

        return methodology

    def archive(self, methodology_id: int, *, actor_id: int):
        methodology = self.get_or_error(methodology_id)

        if methodology.status != MethodologyStatus.PUBLISHED:
            raise HTTPException(
                status_code=409,
                detail="Only published methodologies can be archived",
            )

        if methodology.is_active:
            raise HTTPException(
                status_code=409,
                detail=(
                    "The active methodology cannot be archived. "
                    "Activate another methodology first"
                ),
            )

        methodology.status = MethodologyStatus.ARCHIVED

        AuditService.record(
            db=self.db,
            action="methodology.archived",
            resource_type="methodology",
            resource_id=methodology.id,
            actor_id=actor_id,
            context={
                "status": MethodologyStatus.ARCHIVED.value,
                "version": methodology.version,
            },
        )

        self.db.commit()
        self.db.refresh(methodology)

        return methodology

    def get_active(self):
        methodologies = (
            self.db.query(Methodology)
            .filter(
                Methodology.status == MethodologyStatus.PUBLISHED,
                Methodology.is_active.is_(True),
            )
            .all()
        )

        if not methodologies:
            raise HTTPException(
                status_code=409,
                detail="No active methodology is configured",
            )

        if len(methodologies) > 1:
            raise HTTPException(
                status_code=500,
                detail="Multiple active methodologies are configured",
            )

        return methodologies[0]

    def get_or_error(self, methodology_id: int):
        methodology = self.read(methodology_id)

        if not methodology:
            raise HTTPException(
                status_code=404,
                detail="Methodology not found",
            )

        return methodology