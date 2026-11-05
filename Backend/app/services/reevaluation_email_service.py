
import smtplib

from email.message import EmailMessage

from app.core.config import settings
from app.models.reevaluation_reminder_model import ReminderType


class ReevaluationEmailService:

    SUBJECTS = {
        ReminderType.FIRST: "Tu próxima evaluación ASG se acerca",
        ReminderType.SECOND: "Recordatorio de evaluación ASG",
        ReminderType.DUE: "Hoy corresponde realizar tu evaluación ASG",
    }

    def send(self, recipient: str, reminder) -> None:
        if not settings.smtp_enabled:
            raise RuntimeError(
                "SMTP is disabled"
            )

        message = EmailMessage()

        message["From"] = settings.smtp_from_email
        message["To"] = recipient
        message["Subject"] = self.SUBJECTS[reminder.reminder_type]

        message.set_content(
            self._build_message(reminder)
        )

        with smtplib.SMTP(
            settings.smtp_host,
            settings.smtp_port,
            timeout=30,
        ) as smtp:
            smtp.ehlo()

            if settings.smtp_use_starttls:
                smtp.starttls()
                smtp.ehlo()

            if settings.smtp_username:
                smtp.login(
                    settings.smtp_username,
                    settings.smtp_password,
                )

            smtp.send_message(message)

    def _build_message(self, reminder) -> str:
        target_date = reminder.target_date.strftime("%d/%m/%Y")

        if reminder.reminder_type == ReminderType.FIRST:
            introduction = (
                "Tu próxima evaluación ASG está programada "
                "dentro de 30 días."
            )
        elif reminder.reminder_type == ReminderType.SECOND:
            introduction = (
                "Faltan 7 días para tu próxima evaluación ASG."
            )
        else:
            introduction = (
                "Hoy es la fecha programada para tu "
                "próxima evaluación ASG."
            )

        return (
            "Hola,\n\n"
            f"{introduction}\n\n"
            f"Fecha de evaluación: {target_date}\n\n"
            "Ingresa a MetricASG para consultar tu información "
            "y realizar tu próxima evaluación cuando esté habilitada.\n\n"
            "Saludos,\n"
            "Equipo MetricASG"
        )
