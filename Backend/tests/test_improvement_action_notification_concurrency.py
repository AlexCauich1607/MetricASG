from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.improvement_action_notification_service import (
    ImprovementActionNotificationService,
)


def test_improvement_notification_advisory_lock(
    independent_db_connections,
):
    first_connection, second_connection = (
        independent_db_connections
    )

    lock_id = (
        ImprovementActionNotificationService.ADVISORY_LOCK_ID
    )

    first_pid = first_connection.execute(
        text("SELECT pg_backend_pid()")
    ).scalar_one()

    second_pid = second_connection.execute(
        text("SELECT pg_backend_pid()")
    ).scalar_one()

    assert first_pid != second_pid

    try:
        acquired_first = first_connection.execute(
            text(
                "SELECT pg_try_advisory_xact_lock(:lock_id)"
            ),
            {"lock_id": lock_id},
        ).scalar_one()

        assert acquired_first is True

        acquired_second = second_connection.execute(
            text(
                "SELECT pg_try_advisory_xact_lock(:lock_id)"
            ),
            {"lock_id": lock_id},
        ).scalar_one()

        assert acquired_second is False

        # El servicio debe omitir el procesamiento si el
        # bloqueo está retenido por otra conexión.
        session = Session(
            bind=second_connection,
            expire_on_commit=False,
        )

        try:
            service = ImprovementActionNotificationService(
                session
            )

            assert service.generate() == 0

        finally:
            session.close()

        # Liberar el bloqueo de la primera conexión.
        first_connection.rollback()

        acquired_after_release = second_connection.execute(
            text(
                "SELECT pg_try_advisory_xact_lock(:lock_id)"
            ),
            {"lock_id": lock_id},
        ).scalar_one()

        assert acquired_after_release is True

    finally:
        first_connection.rollback()
        second_connection.rollback()


def test_improvement_notification_lock_released_after_error(
    independent_db_connections,
    monkeypatch,
):
    import pytest

    first_connection, second_connection = (
        independent_db_connections
    )

    lock_id = (
        ImprovementActionNotificationService.ADVISORY_LOCK_ID
    )

    session = Session(
        bind=first_connection,
        expire_on_commit=False,
    )

    def fail_during_processing(*args, **kwargs):
        raise RuntimeError("Simulated notification processing error")

    monkeypatch.setattr(
        ImprovementActionNotificationService,
        "cancel_obsolete",
        fail_during_processing,
    )

    try:
        service = ImprovementActionNotificationService(session)

        with pytest.raises(
            RuntimeError,
            match="Simulated notification processing error",
        ):
            service.generate()

        # El rollback de generate() debe liberar el bloqueo.
        acquired_after_error = second_connection.execute(
            text("SELECT pg_try_advisory_xact_lock(:lock_id)"),
            {"lock_id": lock_id},
        ).scalar_one()

        assert acquired_after_error is True

    finally:
        session.close()
        first_connection.rollback()
        second_connection.rollback()
