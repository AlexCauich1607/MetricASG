"""add improvement actions

Revision ID: eb60fa314d21
Revises: 1c6f7266ed7f
Create Date: 2026-11-03 19:48:25.603227

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'eb60fa314d21'
down_revision: Union[str, Sequence[str], None] = '1c6f7266ed7f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    """Create improvement actions table."""
    op.create_table(
        "improvement_actions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("evaluation_id", sa.Integer(), nullable=False),
        sa.Column("indicator_id", sa.Integer(), nullable=True),
        sa.Column("gap_description", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "priority",
            sa.Enum(
                "LOW",
                "MEDIUM",
                "HIGH",
                name="improvement_priority",
                native_enum=False,
                create_constraint=True,
            ),
            server_default="MEDIUM",
            nullable=False,
        ),
        sa.Column("responsible", sa.String(length=150), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "IN_PROGRESS",
                "COMPLETED",
                "CANCELLED",
                name="improvement_status",
                native_enum=False,
                create_constraint=True,
            ),
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["evaluation_id"],
            ["evaluations.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["indicator_id"],
            ["indicators.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_improvement_actions_evaluation_id",
        "improvement_actions",
        ["evaluation_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop improvement actions table."""
    op.drop_index(
        "ix_improvement_actions_evaluation_id",
        table_name="improvement_actions",
    )

    op.drop_table("improvement_actions")
