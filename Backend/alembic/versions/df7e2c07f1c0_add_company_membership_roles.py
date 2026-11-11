"""add company membership roles

Revision ID: df7e2c07f1c0
Revises: 8ee1f911e422
Create Date: 2026-11-07 17:57:17.564678

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'df7e2c07f1c0'
down_revision: Union[str, Sequence[str], None] = '8ee1f911e422'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "company_memberships",
        sa.Column(
            "role",
            sa.Enum(
                "COMPANY_ADMIN",
                "ASG_MANAGER",
                "COLLABORATOR",
                "AUDITOR",
                name="company_role",
                native_enum=False,
                create_constraint=False,
            ),
            nullable=False,
            server_default="COLLABORATOR",
        ),
    )

    op.create_check_constraint(
        "ck_company_memberships_role",
        "company_memberships",
        "role IN ("
        "'COMPANY_ADMIN', "
        "'ASG_MANAGER', "
        "'COLLABORATOR', "
        "'AUDITOR'"
        ")",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_company_memberships_role",
        "company_memberships",
        type_="check",
    )

    op.drop_column(
        "company_memberships",
        "role",
    )