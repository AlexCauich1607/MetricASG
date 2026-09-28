"""add methodology versioning

Revision ID: ab81f5a292c8
Revises: a29a23d6969d
Create Date: 2026-09-26 22:45:55.219037

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ab81f5a292c8"
down_revision: Union[str, Sequence[str], None] = "a29a23d6969d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "methodologies",
        sa.Column(
            "id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "name",
            sa.String(length=150),
            nullable=False,
        ),
        sa.Column(
            "version",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "DRAFT",
                "PUBLISHED",
                "ARCHIVED",
                name="methodology_status",
                native_enum=False,
                create_constraint=True,
            ),
            server_default="DRAFT",
            nullable=False,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "NOT is_active OR status = 'PUBLISHED'",
            name="ck_methodology_active_published",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("version"),
    )

    op.create_index(
        "uq_methodologies_single_active",
        "methodologies",
        ["is_active"],
        unique=True,
        postgresql_where=sa.text("is_active = true"),
    )

    connection = op.get_bind()

    methodology_id = connection.execute(
        sa.text(
            """
            INSERT INTO methodologies (
                name,
                version,
                status,
                is_active
            )
            VALUES (
                :name,
                :version,
                :status,
                :is_active
            )
            RETURNING id
            """
        ),
        {
            "name": "Metodología ASG",
            "version": "1.0.0",
            "status": "PUBLISHED",
            "is_active": True,
        },
    ).scalar_one()

    op.add_column(
        "ambits",
        sa.Column(
            "methodology_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.add_column(
        "evaluations",
        sa.Column(
            "methodology_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.add_column(
        "maturity_levels",
        sa.Column(
            "methodology_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    connection.execute(
        sa.text(
            """
            UPDATE ambits
            SET methodology_id = :methodology_id
            """
        ),
        {"methodology_id": methodology_id},
    )

    connection.execute(
        sa.text(
            """
            UPDATE evaluations
            SET methodology_id = :methodology_id
            """
        ),
        {"methodology_id": methodology_id},
    )

    connection.execute(
        sa.text(
            """
            UPDATE maturity_levels
            SET methodology_id = :methodology_id
            """
        ),
        {"methodology_id": methodology_id},
    )

    op.alter_column(
        "ambits",
        "methodology_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    op.alter_column(
        "evaluations",
        "methodology_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    op.alter_column(
        "maturity_levels",
        "methodology_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    op.create_foreign_key(
        "fk_ambits_methodology_id_methodologies",
        "ambits",
        "methodologies",
        ["methodology_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_foreign_key(
        "fk_evaluations_methodology_id_methodologies",
        "evaluations",
        "methodologies",
        ["methodology_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_foreign_key(
        "fk_maturity_levels_methodology_id_methodologies",
        "maturity_levels",
        "methodologies",
        ["methodology_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_maturity_levels_methodology_id_methodologies",
        "maturity_levels",
        type_="foreignkey",
    )

    op.drop_constraint(
        "fk_evaluations_methodology_id_methodologies",
        "evaluations",
        type_="foreignkey",
    )

    op.drop_constraint(
        "fk_ambits_methodology_id_methodologies",
        "ambits",
        type_="foreignkey",
    )

    op.drop_column(
        "maturity_levels",
        "methodology_id",
    )

    op.drop_column(
        "evaluations",
        "methodology_id",
    )

    op.drop_column(
        "ambits",
        "methodology_id",
    )

    op.drop_index(
        "uq_methodologies_single_active",
        table_name="methodologies",
        postgresql_where=sa.text("is_active = true"),
    )

    op.drop_table("methodologies")