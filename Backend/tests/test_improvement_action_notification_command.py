from datetime import datetime
from unittest.mock import MagicMock

from app.commands import (
    generate_improvement_action_notifications as command,
)


def test_improvement_notification_command_uses_configured_timezone(
    monkeypatch,
):
    captured = {}

    class FakeService:
        def __init__(self, db):
            captured["db"] = db

        def generate(self, today):
            captured["today"] = today
            return 3

    fake_db = MagicMock()

    class FakeSessionLocal:
        def __enter__(self):
            return fake_db

        def __exit__(self, exc_type, exc_value, traceback):
            captured["session_closed"] = True

    monkeypatch.setattr(
        command,
        "SessionLocal",
        FakeSessionLocal,
    )
    monkeypatch.setattr(
        command,
        "ImprovementActionNotificationService",
        FakeService,
    )

    result = command.main()

    assert result["created"] == 3
    assert result["date"] == captured["today"].isoformat()
    assert captured["session_closed"] is True

    assert captured["today"] == (
        datetime.now(
            command.ZoneInfo(command.settings.reminder_timezone)
        ).date()
    )


def test_improvement_notification_command_closes_session_on_error(
    monkeypatch,
):
    import pytest

    captured = {"session_closed": False}

    class FailingService:
        def __init__(self, db):
            pass

        def generate(self, today):
            raise RuntimeError("Simulated producer failure")

    class FakeSessionLocal:
        def __enter__(self):
            return object()

        def __exit__(self, exc_type, exc_value, traceback):
            captured["session_closed"] = True

    monkeypatch.setattr(
        command,
        "SessionLocal",
        FakeSessionLocal,
    )
    monkeypatch.setattr(
        command,
        "ImprovementActionNotificationService",
        FailingService,
    )

    with pytest.raises(
        RuntimeError,
        match="Simulated producer failure",
    ):
        command.main()

    assert captured["session_closed"] is True
