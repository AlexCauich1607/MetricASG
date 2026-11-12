from typing import Any

from sqlalchemy.orm import Session

from app.models.audit_log_model import AuditLog

from datetime import datetime

from sqlalchemy import func, select

class AuditService:
    @staticmethod
    def record(
        db: Session,
        *,
        action: str,
        resource_type: str,
        resource_id: int | None = None,
        actor_id: int | None = None,
        company_id: int | None = None,
        context: dict[str, Any] | None = None,
    ) -> AuditLog:
        audit_log = AuditLog(
            actor_id=actor_id,
            company_id=company_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            context=dict(context) if context is not None else {},
        )

        db.add(audit_log)

        return audit_log


    @staticmethod
    def list_logs(
        db: Session,
        *,
        actor_id: int | None = None,
        company_id: int | None = None,
        action: str | None = None,
        resource_type: str | None = None,
        resource_id: int | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> dict[str, Any]:
        filters = []

        if actor_id is not None:
            filters.append(AuditLog.actor_id == actor_id)

        if company_id is not None:
            filters.append(AuditLog.company_id == company_id)

        if action is not None:
            filters.append(AuditLog.action == action)

        if resource_type is not None:
            filters.append(
                AuditLog.resource_type == resource_type
            )

        if resource_id is not None:
            filters.append(AuditLog.resource_id == resource_id)

        if start_date is not None:
            filters.append(AuditLog.created_at >= start_date)

        if end_date is not None:
            filters.append(AuditLog.created_at <= end_date)

        total = db.scalar(
            select(func.count(AuditLog.id)).where(*filters)
        )

        statement = (
            select(AuditLog)
            .where(*filters)
            .order_by(
                AuditLog.created_at.desc(),
                AuditLog.id.desc(),
            )
            .limit(limit)
            .offset(offset)
        )

        items = db.scalars(statement).all()

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "items": items,
        }
