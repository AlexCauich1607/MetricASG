
import subprocess
import sys


def test_reconcile_command_runs_independently():
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "app.commands.reconcile_evidences",
        ],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )

    assert result.returncode == 0, result.stderr

    assert (
        "Evidence storage reconciliation"
        in result.stdout
    )

    assert "Storage directory:" in result.stdout
    assert "Potential orphan files:" in result.stdout

    assert (
        "Diagnostic completed. No files were deleted."
        in result.stdout
    )
