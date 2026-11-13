import logging

from datetime import datetime
from zoneinfo import ZoneInfo

from app import models  # noqa: F401
from app.core.config import settings
from app.database.database import SessionLocal
from app.services.improvement_action_notification_service import (
    ImprovementActionNotificationService,
)


logger = logging.getLogger(__name__)


def main() -> dict:
    timezone = ZoneInfo(settings.reminder_timezone)
    today = datetime.now(timezone).date()

    with SessionLocal() as db:
        service = ImprovementActionNotificationService(db)

        created = service.generate(today=today)

        logger.info(
            "Improvement action notifications processed. "
            "Date: %s, created: %s",
            today.isoformat(),
            created,
        )

        return {
            "date": today.isoformat(),
            "created": created,
        }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
