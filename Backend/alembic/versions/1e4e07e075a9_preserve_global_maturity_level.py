"""preserve global maturity level

Revision ID: 1e4e07e075a9
Revises: ab81f5a292c8
Create Date: 2026-09-28 23:33:39.038315

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1e4e07e075a9"
down_revision: Union[str, Sequence[str], None] = "ab81f5a292c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


FK_NAME = "fk_evaluations_global_maturity_level_id_maturity_levels"


def upgrade() -> None:
    """Upgrade schema."""

    op.add_column(
        "evaluations",
        sa.Column(
            "global_maturity_level_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    connection = op.get_bind()

    connection.execute(
        sa.text(
            """
            UPDATE evaluations AS e
            SET global_maturity_level_id = (
                SELECT ml.id
                FROM maturity_levels AS ml
                WHERE
                    ml.methodology_id = e.methodology_id
                    AND ml.min_score <= e.global_score
                    AND (
                        (
                            ml.min_score = (
                                SELECT MAX(ml_last.min_score)
                                FROM maturity_levels AS ml_last
                                WHERE
                                    ml_last.methodology_id
                                    = e.methodology_id
                            )
                            AND e.global_score <= ml.max_score
                        )
                        OR
                        (
                            ml.min_score < (
                                SELECT MAX(ml_last.min_score)
                                FROM maturity_levels AS ml_last
                                WHERE
                                    ml_last.methodology_id
                                    = e.methodology_id
                            )
                            AND e.global_score < ml.max_score
                        )
                    )
                ORDER BY ml.min_score ASC
                LIMIT 1
            )
            WHERE
                e.status = 'COMPLETED'
                AND e.global_score IS NOT NULL
            """
        )
    )

    missing_snapshots = connection.execute(
        sa.text(
            """
            SELECT COUNT(*)
            FROM evaluations
            WHERE
                status = 'COMPLETED'
                AND (
                    global_score IS NULL
                    OR global_maturity_level_id IS NULL
                )
            """
        )
    ).scalar_one()

    if missing_snapshots:
        raise RuntimeError(
            "Cannot preserve historical maturity levels: "
            f"{missing_snapshots} completed evaluation(s) "
            "could not be assigned a global maturity level."
        )

    op.create_foreign_key(
        FK_NAME,
        "evaluations",
        "maturity_levels",
        ["global_maturity_level_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_constraint(
        FK_NAME,
        "evaluations",
        type_="foreignkey",
    )

    op.drop_column(
        "evaluations",
        "global_maturity_level_id",
    )