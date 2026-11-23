
"""Include company in reevaluation reminder uniqueness.

Revision ID: c8f3e20d5b61
Revises: b7e2d19c4a50
"""

from alembic import op


revision = "c8f3e20d5b61"
down_revision = "b7e2d19c4a50"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "uq_reevaluation_reminder_delivery",
        "reevaluation_reminders",
        type_="unique",
    )

    op.create_unique_constraint(
        "uq_reevaluation_reminder_delivery",
        "reevaluation_reminders",
        [
            "user_id",
            "company_id",
            "target_date",
            "reminder_type",
            "channel",
        ],
    )


def downgrade() -> None:
    # El esquema anterior no admite dos recordatorios de empresas
    # diferentes para el mismo usuario, fecha, tipo y canal.
    # Evitar perder registros durante el downgrade.
    connection = op.get_bind()

    duplicates = connection.exec_driver_sql(
        """
        SELECT COUNT(*) FROM (
            SELECT
                user_id,
                target_date,
                reminder_type,
                channel
            FROM reevaluation_reminders
            GROUP BY
                user_id,
                target_date,
                reminder_type,
                channel
            HAVING COUNT(*) > 1
        ) AS duplicated_groups
        """
    ).scalar_one()

    if duplicates:
        raise RuntimeError(
            "Cannot downgrade: company-specific reminders "
            "would violate the previous uniqueness constraint."
        )

    op.drop_constraint(
        "uq_reevaluation_reminder_delivery",
        "reevaluation_reminders",
        type_="unique",
    )

    op.create_unique_constraint(
        "uq_reevaluation_reminder_delivery",
        "reevaluation_reminders",
        [
            "user_id",
            "target_date",
            "reminder_type",
            "channel",
        ],
    )
