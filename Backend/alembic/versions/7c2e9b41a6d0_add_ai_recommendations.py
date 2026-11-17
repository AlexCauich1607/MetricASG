
"""add ai recommendations

Revision ID: 7c2e9b41a6d0
Revises: 5a1b28f0cce6

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7c2e9b41a6d0"
down_revision: Union[str, Sequence[str], None] = "5a1b28f0cce6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create AI recommendations table."""

    op.create_table(
        "ai_recommendations",
        sa.Column(
            "id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column("evaluation_id", sa.Integer(), nullable=False),
        sa.Column("indicator_id", sa.Integer(), nullable=True),
        sa.Column("gap_description", sa.Text(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("justification", sa.Text(), nullable=False),
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
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "ACCEPTED",
                "REJECTED",
                name="ai_recommendation_status",
                native_enum=False,
                create_constraint=True,
            ),
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column(
            "reviewed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "improvement_action_id",
            sa.Integer(),
            nullable=True,
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
        sa.ForeignKeyConstraint(
            ["reviewed_by"],
            ["users.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["improvement_action_id"],
            ["improvement_actions.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("improvement_action_id"),
    )

    op.create_index(
        "ix_ai_recommendations_evaluation_id",
        "ai_recommendations",
        ["evaluation_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop AI recommendations table."""

    op.drop_index(
        "ix_ai_recommendations_evaluation_id",
        table_name="ai_recommendations",
    )

    op.drop_table("ai_recommendations")
