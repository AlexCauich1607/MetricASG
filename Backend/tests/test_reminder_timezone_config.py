
import pytest

from pydantic import ValidationError

from app.core.config import Settings


def test_accepts_valid_reminder_timezone(monkeypatch):
    monkeypatch.setenv(
        "REMINDER_TIMEZONE",
        "Europe/Madrid",
    )

    configuration = Settings()

    assert configuration.reminder_timezone == "Europe/Madrid"


def test_rejects_invalid_reminder_timezone(monkeypatch):
    monkeypatch.setenv(
        "REMINDER_TIMEZONE",
        "Invalid/Timezone",
    )

    with pytest.raises(
        ValidationError,
        match="Invalid reminder timezone",
    ):
        Settings()


def test_accepts_merida_timezone(monkeypatch):
    monkeypatch.setenv(
        "REMINDER_TIMEZONE",
        "America/Merida",
    )

    configuration = Settings()

    assert configuration.reminder_timezone == "America/Merida"
