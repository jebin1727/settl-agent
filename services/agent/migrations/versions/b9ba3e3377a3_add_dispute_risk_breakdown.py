"""add dispute risk breakdown

Revision ID: b9ba3e3377a3
Revises: dd952ca7ad8c
Create Date: 2026-11-12 07:07:46.192557

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b9ba3e3377a3'
down_revision: Union[str, Sequence[str], None] = 'dd952ca7ad8c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('disputes', sa.Column('risk_breakdown', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('disputes', 'risk_breakdown')
