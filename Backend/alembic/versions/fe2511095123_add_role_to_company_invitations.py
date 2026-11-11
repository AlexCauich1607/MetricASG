"""add role to company invitations

Revision ID: fe2511095123
Revises: df7e2c07f1c0
Create Date: 2026-11-11 01:28:59.328449

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fe2511095123'
down_revision: Union[str, Sequence[str], None] = 'df7e2c07f1c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    """Add company role to invitations."""
    op.add_column(
        "company_invitations",
        sa.Column(
            "role",
            sa.String(length=50),
            nullable=False,
            server_default="COLLABORATOR",
        ),
    )

    op.create_check_constraint(
        "ck_company_invitations_role",
        "company_invitations",
        "role IN ("
        "'COMPANY_ADMIN', "
        "'ASG_MANAGER', "
        "'COLLABORATOR', "
        "'AUDITOR'"
        ")",
    )


def downgrade() -> None:
    """Remove company role from invitations."""
    op.drop_constraint(
        "ck_company_invitations_role",
        "company_invitations",
        type_="check",
    )

    op.drop_column(
        "company_invitations",
        "role",
    )
