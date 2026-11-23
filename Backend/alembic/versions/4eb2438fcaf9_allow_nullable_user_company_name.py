"""allow nullable user company name

Revision ID: 4eb2438fcaf9
Revises: 7c2e9b41a6d0
Create Date: 2026-11-20 21:57:21.269785

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4eb2438fcaf9'
down_revision: Union[str, Sequence[str], None] = '7c2e9b41a6d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Allow personal accounts without a legacy company name."""
    op.alter_column(
        "users",
        "company_name",
        existing_type=sa.String(length=150),
        nullable=True,
    )


def downgrade() -> None:
    """Prevent restoring NOT NULL when company-less users exist."""
    connection = op.get_bind()

    null_count = connection.execute(
        sa.text(
            "SELECT COUNT(*) FROM users WHERE company_name IS NULL"
        )
    ).scalar_one()

    if null_count:
        raise RuntimeError(
            "Cannot downgrade: users with NULL company_name exist. "
            "A supervised data migration is required."
        )

    op.alter_column(
        "users",
        "company_name",
        existing_type=sa.String(length=150),
        nullable=False,
    )