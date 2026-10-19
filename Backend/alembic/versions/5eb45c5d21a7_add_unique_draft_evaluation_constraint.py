"""add unique draft evaluation constraint

Revision ID: 5eb45c5d21a7
Revises: 10c95c6067ce
Create Date: 2026-10-19 22:41:57.296968

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5eb45c5d21a7'
down_revision: Union[str, Sequence[str], None] = '10c95c6067ce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_evaluations_user_methodology_draft",
        "evaluations",
        ["user_id", "methodology_id"],
        unique=True,
        postgresql_where=sa.text("status = 'DRAFT'"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_evaluations_user_methodology_draft",
        table_name="evaluations",
    )