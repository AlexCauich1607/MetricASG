"""add company memberships and migrate evaluations

Revision ID: f62f4c5b5740
Revises: 1e628a8dd16e
Create Date: 2026-11-06 16:15:37.069687

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f62f4c5b5740'
down_revision: Union[str, Sequence[str], None] = '1e628a8dd16e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column(
            "sector_id",
            sa.Integer(),
            sa.ForeignKey("company_sectors.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "size_id",
            sa.Integer(),
            sa.ForeignKey("company_sizes.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "company_memberships",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "ACTIVE",
                "INACTIVE",
                name="company_membership_status",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
            server_default="ACTIVE",
        ),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "user_id",
            "company_id",
            name="uq_company_membership_user_company",
        ),
    )

    op.create_index(
        "ix_company_memberships_user_id",
        "company_memberships",
        ["user_id"],
    )

    op.create_index(
        "ix_company_memberships_company_id",
        "company_memberships",
        ["company_id"],
    )

    op.add_column(
        "evaluations",
        sa.Column("company_id", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "fk_evaluations_company_id_companies",
        "evaluations",
        "companies",
        ["company_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_index(
        "ix_evaluations_company_id",
        "evaluations",
        ["company_id"],
    )

    connection = op.get_bind()

    users = sa.table(
        "users",
        sa.column("id", sa.Integer()),
        sa.column("role", sa.String()),
        sa.column("company_name", sa.String()),
        sa.column("company_sector_id", sa.Integer()),
        sa.column("company_size_id", sa.Integer()),
    )

    companies = sa.table(
        "companies",
        sa.column("id", sa.Integer()),
        sa.column("name", sa.String()),
        sa.column("sector_id", sa.Integer()),
        sa.column("size_id", sa.Integer()),
    )

    memberships = sa.table(
        "company_memberships",
        sa.column("user_id", sa.Integer()),
        sa.column("company_id", sa.Integer()),
        sa.column("status", sa.String()),
    )

    existing_users = connection.execute(
        sa.select(
            users.c.id,
            users.c.company_name,
            users.c.company_sector_id,
            users.c.company_size_id,
        )
        .where(users.c.role == "user")
        .order_by(users.c.id)
    ).mappings().all()

    for existing_user in existing_users:
        company_id = connection.execute(
            companies.insert()
            .values(
                name=existing_user["company_name"],
                sector_id=existing_user["company_sector_id"],
                size_id=existing_user["company_size_id"],
            )
            .returning(companies.c.id)
        ).scalar_one()

        connection.execute(
            memberships.insert().values(
                user_id=existing_user["id"],
                company_id=company_id,
                status="ACTIVE",
            )
        )

    connection.execute(
        sa.text(
            """
            UPDATE evaluations AS e
            SET company_id = cm.company_id
            FROM company_memberships AS cm
            WHERE cm.user_id = e.user_id
              AND e.company_id IS NULL
            """
        )
    )

    missing_companies = connection.execute(
        sa.text(
            """
            SELECT COUNT(*)
            FROM evaluations
            WHERE company_id IS NULL
            """
        )
    ).scalar_one()

    if missing_companies:
        raise RuntimeError(
            f"Cannot migrate evaluations: "
            f"{missing_companies} evaluations have no company"
        )

    op.alter_column(
        "evaluations",
        "company_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    op.drop_index(
        "uq_evaluations_user_methodology_draft",
        table_name="evaluations",
    )

    op.create_index(
        "uq_evaluations_company_user_methodology_draft",
        "evaluations",
        ["company_id", "user_id", "methodology_id"],
        unique=True,
        postgresql_where=sa.text("status = 'DRAFT'"),
    )


def downgrade() -> None:
    raise RuntimeError(
        "Downgrade blocked: reverting company memberships "
        "could destroy company and evaluation ownership data. "
        "A supervised data migration is required."
    )
