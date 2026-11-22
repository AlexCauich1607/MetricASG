
"""Add company reference to reevaluation reminders.

Revision ID: b7e2d19c4a50
Revises: e6c9a71b2d43
"""

from alembic import op
import sqlalchemy as sa


revision = "b7e2d19c4a50"
down_revision = "e6c9a71b2d43"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "reevaluation_reminders",
        sa.Column(
            "company_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_reevaluation_reminders_company_id",
        "reevaluation_reminders",
        "companies",
        ["company_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_index(
        "ix_reevaluation_reminders_company_id",
        "reevaluation_reminders",
        ["company_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_reevaluation_reminders_company_id",
        table_name="reevaluation_reminders",
    )

    op.drop_constraint(
        "fk_reevaluation_reminders_company_id",
        "reevaluation_reminders",
        type_="foreignkey",
    )

    op.drop_column(
        "reevaluation_reminders",
        "company_id",
    )
