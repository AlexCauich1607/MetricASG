
from datetime import date
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.models.reevaluation_reminder_model import ReminderType
from app.services.reevaluation_email_service import (
    ReevaluationEmailService,
)


@pytest.fixture
def reminder():
    return SimpleNamespace(
        reminder_type=ReminderType.FIRST,
        target_date=date(2027, 5, 5),
    )


def test_email_message_contains_target_date(reminder):
    service = ReevaluationEmailService()

    message = service._build_message(reminder)

    assert "30 días" in message
    assert "05/05/2027" in message
    assert "MetricASG" in message


@pytest.mark.parametrize(
    ("reminder_type", "expected_text"),
    [
        (ReminderType.FIRST, "30 días"),
        (ReminderType.SECOND, "7 días"),
        (ReminderType.DUE, "Hoy es la fecha"),
    ],
)
def test_email_message_matches_reminder_type(
    reminder_type,
    expected_text,
):
    service = ReevaluationEmailService()

    reminder = SimpleNamespace(
        reminder_type=reminder_type,
        target_date=date(2027, 5, 5),
    )

    message = service._build_message(reminder)

    assert expected_text in message


def test_smtp_disabled_rejects_sending(reminder):
    service = ReevaluationEmailService()

    with patch(
        "app.services.reevaluation_email_service.settings.smtp_enabled",
        False,
    ):
        with patch(
            "app.services.reevaluation_email_service.smtplib.SMTP"
        ) as smtp_mock:
            with pytest.raises(RuntimeError, match="SMTP is disabled"):
                service.send("user@example.com", reminder)

            smtp_mock.assert_not_called()


def test_smtp_sends_message_with_starttls(reminder):
    service = ReevaluationEmailService()

    config = {
        "smtp_enabled": True,
        "smtp_host": "smtp.example.com",
        "smtp_port": 587,
        "smtp_username": "test-user",
        "smtp_password": "test-password",
        "smtp_from_email": "notifications@example.com",
        "smtp_use_starttls": True,
    }

    with patch.multiple(
        "app.services.reevaluation_email_service.settings",
        **config,
    ):
        with patch(
            "app.services.reevaluation_email_service.smtplib.SMTP"
        ) as smtp_mock:
            smtp = smtp_mock.return_value.__enter__.return_value

            service.send("user@example.com", reminder)

            smtp_mock.assert_called_once_with(
                "smtp.example.com",
                587,
                timeout=30,
            )

            smtp.starttls.assert_called_once()

            smtp.login.assert_called_once_with(
                "test-user",
                "test-password",
            )

            smtp.send_message.assert_called_once()

            message = smtp.send_message.call_args.args[0]

            assert message["To"] == "user@example.com"
            assert message["From"] == "notifications@example.com"
            assert message["Subject"] == (
                "Tu próxima evaluación ASG se acerca"
            )


def test_smtp_error_is_propagated(reminder):
    service = ReevaluationEmailService()

    with patch.multiple(
        "app.services.reevaluation_email_service.settings",
        smtp_enabled=True,
        smtp_host="smtp.example.com",
        smtp_port=587,
        smtp_username="",
        smtp_password="",
        smtp_from_email="notifications@example.com",
        smtp_use_starttls=True,
    ):
        with patch(
            "app.services.reevaluation_email_service.smtplib.SMTP",
            side_effect=ConnectionError("SMTP unavailable"),
        ):
            with pytest.raises(
                ConnectionError,
                match="SMTP unavailable",
            ):
                service.send("user@example.com", reminder)
