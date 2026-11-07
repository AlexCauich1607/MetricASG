"""add unique pending company invitation index

Revision ID: 5eb4f202dab0
Revises: f99eda744c9b
Create Date: 2026-11-06 20:47:01.284926

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5eb4f202dab0'
down_revision: Union[str, Sequence[str], None] = 'f99eda744c9b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    op.create_index(
        "uq_company_invitations_pending_company_email",
        "company_invitations",
        ["company_id", "email"],
        unique=True,
        postgresql_where=sa.text("status = 'PENDING'"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_company_invitations_pending_company_email",
        table_name="company_invitations",
    )
