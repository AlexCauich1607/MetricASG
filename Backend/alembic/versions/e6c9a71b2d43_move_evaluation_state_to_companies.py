
"""Move evaluation state from users to companies.

Revision ID: e6c9a71b2d43
Revises: 4eb2438fcaf9
"""

from alembic import op
import sqlalchemy as sa


revision = "e6c9a71b2d43"
down_revision = "4eb2438fcaf9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "companies",
        sa.Column(
            "biannual_evaluation",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.add_column(
        "companies",
        sa.Column(
            "next_evaluation",
            sa.DateTime(),
            nullable=True,
        ),
    )

    # Recuperar el estado empresarial desde su historial real.
    # No utilizar los valores heredados de users.
    op.execute(
        """
        UPDATE companies AS c
        SET
            biannual_evaluation = TRUE,
            next_evaluation =
                latest.last_completed_date + INTERVAL '6 months'
        FROM (
            SELECT
                company_id,
                MAX(date) AS last_completed_date
            FROM evaluations
            WHERE status = 'COMPLETED'
            GROUP BY company_id
        ) AS latest
        WHERE latest.company_id = c.id
          AND latest.last_completed_date IS NOT NULL
        """
    )

    # Si existe una evaluación completada sin fecha,
    # conservar el indicador y dejar pendiente su fecha.
    op.execute(
        """
        UPDATE companies AS c
        SET biannual_evaluation = TRUE
        WHERE EXISTS (
            SELECT 1
            FROM evaluations AS e
            WHERE e.company_id = c.id
              AND e.status = 'COMPLETED'
        )
        """
    )


def downgrade() -> None:
    # No elimina ni altera las columnas heredadas de users.
    op.drop_column("companies", "next_evaluation")
    op.drop_column("companies", "biannual_evaluation")
