
import logging
import time

from datetime import datetime, timedelta, time as datetime_time, timezone
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.commands.generate_reevaluation_reminders import (
    main as generate_reevaluation_reminders,
)
from app.commands.generate_improvement_action_notifications import (
    main as generate_improvement_action_notifications,
)

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)

def run_notification_jobs() -> None:
    jobs = (
        (
            "Reevaluation reminders",
            generate_reevaluation_reminders,
        ),
        (
            "Improvement action notifications",
            generate_improvement_action_notifications,
        ),
    )

    for name, job in jobs:
        try:
            job()
        except Exception:
            logger.exception(
                "%s processing failed",
                name,
            )

def seconds_until_next_run(
    timezone_info: ZoneInfo,
    hour: int = 9,
    now: datetime | None = None,
) -> float:
    if not 0 <= hour <= 23:
        raise ValueError("hour must be between 0 and 23")

    if now is None:
        now = datetime.now(timezone_info)
    else:
        if now.tzinfo is None or now.utcoffset() is None:
            raise ValueError("now must be timezone-aware")

        now = now.astimezone(timezone_info)

    next_run = datetime.combine(
        now.date(),
        datetime_time(hour=hour),
        tzinfo=timezone_info,
    )

    if next_run <= now:
        next_run = datetime.combine(
            now.date() + timedelta(days=1),
            datetime_time(hour=hour),
            tzinfo=timezone_info,
        )

    return (
        next_run.astimezone(timezone.utc)
        - now.astimezone(timezone.utc)
    ).total_seconds()

def run_scheduler():
    timezone = ZoneInfo(settings.reminder_timezone)

    logger.info(
        "Notification scheduler started. Timezone: %s",
        timezone.key,
    )

    while True:
        run_notification_jobs()

        delay = seconds_until_next_run(timezone)

        logger.info(
            "Next reminder generation in %.0f seconds",
            delay,
        )

        time.sleep(delay)

if __name__ == "__main__":
    run_scheduler()
