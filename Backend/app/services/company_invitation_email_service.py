
import smtplib

from email.message import EmailMessage

from app.core.config import settings


class CompanyInvitationEmailService:

    @staticmethod
    def ensure_available() -> None:
        if not settings.smtp_enabled:
            raise RuntimeError(
                "SMTP is disabled"
            )

    def send(
        self,
        recipient: str,
        company_name: str,
        token: str,
    ) -> None:
        self.ensure_available()

        message = EmailMessage()

        message["From"] = settings.smtp_from_email
        message["To"] = recipient
        message["Subject"] = "Invitación para unirte a una empresa en MetricASG"

        message.set_content(
            self._build_message(
                company_name=company_name,
                token=token,
            )
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

    def _build_message(
        self,
        company_name: str,
        token: str,
    ) -> str:
        return (
            "Hola,\n\n"
            f"Has recibido una invitación para unirte a "
            f"{company_name} en MetricASG.\n\n"
            "Para aceptar la invitación, inicia sesión en "
            "MetricASG y utiliza el siguiente código:\n\n"
            f"{token}\n\n"
            "La invitación es válida durante 7 días.\n"
            "Si no esperabas esta invitación, puedes ignorar "
            "este mensaje.\n\n"
            "Saludos,\n"
            "Equipo MetricASG"
        )
