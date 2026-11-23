
"""Remove legacy company fields from users.

Revision ID: 05dbcf87ffc6
Revises: c8f3e20d5b61
"""

from alembic import op
import sqlalchemy as sa


revision = "05dbcf87ffc6"
down_revision = "c8f3e20d5b61"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "users_company_sector_id_fkey",
        "users",
        type_="foreignkey",
    )

    op.drop_constraint(
        "users_company_size_id_fkey",
        "users",
        type_="foreignkey",
    )

    op.drop_column("users", "company_name")
    op.drop_column("users", "company_sector_id")
    op.drop_column("users", "company_size_id")
    op.drop_column("users", "biannual_evaluation")
    op.drop_column("users", "next_evaluation")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("company_name", sa.String(150), nullable=True),
    )

    op.add_column(
        "users",
        sa.Column("company_sector_id", sa.Integer(), nullable=True),
    )

    op.add_column(
        "users",
        sa.Column("company_size_id", sa.Integer(), nullable=True),
    )

    op.add_column(
        "users",
        sa.Column(
            "biannual_evaluation",
            sa.Boolean(),
            nullable=True,
        ),
    )

    op.add_column(
        "users",
        sa.Column("next_evaluation", sa.DateTime(), nullable=True),
    )

    op.create_foreign_key(
        "users_company_sector_id_fkey",
        "users",
        "company_sectors",
        ["company_sector_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_foreign_key(
        "users_company_size_id_fkey",
        "users",
        "company_sizes",
        ["company_size_id"],
        ["id"],
        ondelete="SET NULL",
    )
