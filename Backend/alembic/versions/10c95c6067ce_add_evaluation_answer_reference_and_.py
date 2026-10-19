"""add evaluation answer reference and uniqueness

Revision ID: 10c95c6067ce
Revises: 1e4e07e075a9
Create Date: 2026-10-19 21:20:30.285422

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '10c95c6067ce'
down_revision: Union[str, Sequence[str], None] = '1e4e07e075a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add answer reference and prevent duplicate indicator responses."""

    op.add_column(
        "evaluation_indicator_response",
        sa.Column(
            "indicator_answer_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_evaluation_indicator_response_indicator_answer_id",
        "evaluation_indicator_response",
        "indicator_answers",
        ["indicator_answer_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_unique_constraint(
        "uq_evaluation_indicator_response",
        "evaluation_indicator_response",
        ["evaluation_id", "indicator_id"],
    )


def downgrade() -> None:
    """Remove answer reference and uniqueness constraint."""

    op.drop_constraint(
        "uq_evaluation_indicator_response",
        "evaluation_indicator_response",
        type_="unique",
    )

    op.drop_constraint(
        "fk_evaluation_indicator_response_indicator_answer_id",
        "evaluation_indicator_response",
        type_="foreignkey",
    )

    op.drop_column(
        "evaluation_indicator_response",
        "indicator_answer_id",
    )
