
from unittest.mock import MagicMock, patch

import pytest

from app.services.company_invitation_email_service import (
    CompanyInvitationEmailService,
)


def test_send_company_invitation_email_success():
    service = CompanyInvitationEmailService()

    with patch(
        "app.services.company_invitation_email_service.settings"
    ) as mock_settings, patch(
        "app.services.company_invitation_email_service.smtplib.SMTP"
    ) as mock_smtp:

        mock_settings.smtp_enabled = True
        mock_settings.smtp_from_email = "noreply@test.local"
        mock_settings.smtp_host = "smtp.test.local"
        mock_settings.smtp_port = 587
        mock_settings.smtp_use_starttls = True
        mock_settings.smtp_username = "test-user"
        mock_settings.smtp_password = "test-password"

        smtp_connection = MagicMock()
        mock_smtp.return_value.__enter__.return_value = smtp_connection

        service.send(
            recipient="recipient@test.local",
            company_name="Test Company",
            token="secure-test-token",
        )

        mock_smtp.assert_called_once_with(
            "smtp.test.local",
            587,
            timeout=30,
        )

        smtp_connection.starttls.assert_called_once()
        smtp_connection.login.assert_called_once_with(
            "test-user",
            "test-password",
        )

        smtp_connection.send_message.assert_called_once()

        message = smtp_connection.send_message.call_args.args[0]

        assert message["From"] == "noreply@test.local"
        assert message["To"] == "recipient@test.local"
        assert message["Subject"] == (
            "Invitación para unirte a una empresa en MetricASG"
        )

        body = message.get_content()

        assert "Test Company" in body
        assert "secure-test-token" in body
        assert "7 días" in body


def test_send_company_invitation_email_rejects_disabled_smtp():
    service = CompanyInvitationEmailService()

    with patch(
        "app.services.company_invitation_email_service.settings"
    ) as mock_settings, patch(
        "app.services.company_invitation_email_service.smtplib.SMTP"
    ) as mock_smtp:

        mock_settings.smtp_enabled = False

        with pytest.raises(
            RuntimeError,
            match="SMTP is disabled",
        ):
            service.send(
                recipient="recipient@test.local",
                company_name="Test Company",
                token="secure-test-token",
            )

        mock_smtp.assert_not_called()
