
from app import models  # noqa: F401
from app.database.database import SessionLocal
from app.services.reevaluation_reminder_service import (
    ReevaluationReminderService,
)
from app.services.reevaluation_reminder_delivery_service import (
    ReevaluationReminderDeliveryService,
)


def main():
    with SessionLocal() as db:
        reminder_service = ReevaluationReminderService(db)

        cancelled = reminder_service.cancel_obsolete_in_app()
        created = reminder_service.generate()

        delivery_service = ReevaluationReminderDeliveryService(db)
        delivery_results = delivery_service.deliver_pending()

        print("Reevaluation reminders processing")
        print(f"Cancelled IN_APP reminders: {cancelled}")
        print(f"New reminders: {created}")
        print(f"Emails sent: {delivery_results['sent']}")
        print(f"Emails failed: {delivery_results['failed']}")
        print(f"Emails cancelled: {delivery_results['cancelled']}")
        print("Processing completed successfully.")

    return {
        "cancelled_in_app": cancelled,
        "created": created,
        **delivery_results,
    }


if __name__ == "__main__":
    main()
