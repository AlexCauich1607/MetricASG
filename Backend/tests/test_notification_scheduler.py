import pytest

from app.commands import run_reminder_scheduler as scheduler


def test_run_notification_jobs_executes_both(monkeypatch):
    executed = []

    monkeypatch.setattr(
        scheduler,
        "generate_reevaluation_reminders",
        lambda: executed.append("reevaluation"),
    )

    monkeypatch.setattr(
        scheduler,
        "generate_improvement_action_notifications",
        lambda: executed.append("improvement"),
    )

    scheduler.run_notification_jobs()

    assert executed == [
        "reevaluation",
        "improvement",
    ]


def test_run_notification_jobs_continues_when_reevaluation_fails(
    monkeypatch,
    caplog,
):
    executed = []

    def failed_reevaluation():
        executed.append("reevaluation")
        raise RuntimeError("Reevaluation processing failed")

    monkeypatch.setattr(
        scheduler,
        "generate_reevaluation_reminders",
        failed_reevaluation,
    )

    monkeypatch.setattr(
        scheduler,
        "generate_improvement_action_notifications",
        lambda: executed.append("improvement"),
    )

    scheduler.run_notification_jobs()

    assert executed == [
        "reevaluation",
        "improvement",
    ]

    assert "Reevaluation reminders processing failed" in caplog.text


def test_run_notification_jobs_handles_improvement_failure(
    monkeypatch,
    caplog,
):
    executed = []

    def failed_improvement():
        executed.append("improvement")
        raise RuntimeError("Improvement processing failed")

    monkeypatch.setattr(
        scheduler,
        "generate_reevaluation_reminders",
        lambda: executed.append("reevaluation"),
    )

    monkeypatch.setattr(
        scheduler,
        "generate_improvement_action_notifications",
        failed_improvement,
    )

    scheduler.run_notification_jobs()

    assert executed == [
        "reevaluation",
        "improvement",
    ]

    assert (
        "Improvement action notifications processing failed"
        in caplog.text
    )
