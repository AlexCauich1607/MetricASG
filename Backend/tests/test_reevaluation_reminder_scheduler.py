
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from app.commands.run_reminder_scheduler import (
    seconds_until_next_run,
)


MERIDA = ZoneInfo("America/Merida")
NEW_YORK = ZoneInfo("America/New_York")


@pytest.mark.parametrize(
    ("current_time", "expected_seconds"),
    [
        (
            datetime(2026, 11, 5, 8, 0, tzinfo=MERIDA),
            3600,
        ),
        (
            datetime(2026, 11, 5, 9, 0, tzinfo=MERIDA),
            86400,
        ),
        (
            datetime(2026, 11, 5, 10, 0, tzinfo=MERIDA),
            82800,
        ),
    ],
)
def test_scheduler_runs_at_nine_am(
    current_time,
    expected_seconds,
):
    result = seconds_until_next_run(
        MERIDA,
        now=current_time,
    )

    assert result == expected_seconds


def test_scheduler_handles_year_transition():
    current_time = datetime(
        2026, 12, 31, 23, 0, tzinfo=MERIDA
    )

    result = seconds_until_next_run(
        MERIDA,
        now=current_time,
    )

    assert result == 36000


def test_scheduler_handles_leap_year():
    current_time = datetime(
        2028, 2, 28, 10, 0, tzinfo=MERIDA
    )

    result = seconds_until_next_run(
        MERIDA,
        now=current_time,
    )

    assert result == 82800


def test_scheduler_handles_dst_start():
    # Nueva York adelanta el reloj el 8 de marzo de 2026.
    current_time = datetime(
        2026, 3, 7, 10, 0, tzinfo=NEW_YORK
    )

    result = seconds_until_next_run(
        NEW_YORK,
        now=current_time,
    )

    # 23 horas menos una hora por el cambio de horario.
    assert result == 79200


def test_scheduler_handles_dst_end():
    # Nueva York atrasa el reloj el 1 de noviembre de 2026.
    current_time = datetime(
        2026, 10, 31, 10, 0, tzinfo=NEW_YORK
    )

    result = seconds_until_next_run(
        NEW_YORK,
        now=current_time,
    )

    # 23 horas más una hora por el cambio de horario.
    assert result == 86400


def test_scheduler_rejects_invalid_hour():
    with pytest.raises(ValueError, match="hour"):
        seconds_until_next_run(
            MERIDA,
            hour=24,
            now=datetime(2026, 11, 5, 8, 0, tzinfo=MERIDA),
        )


def test_scheduler_rejects_naive_datetime():
    with pytest.raises(ValueError, match="timezone-aware"):
        seconds_until_next_run(
            MERIDA,
            now=datetime(2026, 11, 5, 8, 0),
        )
