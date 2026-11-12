"""add dispute amount, currency_code, reason

Revision ID: c4f1a9d82e5b
Revises: b9ba3e3377a3
Create Date: 2026-11-12 08:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4f1a9d82e5b'
down_revision: Union[str, Sequence[str], None] = 'b9ba3e3377a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('disputes', sa.Column('amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('disputes', sa.Column('currency_code', sa.String(length=3), nullable=True))
    op.add_column('disputes', sa.Column('reason', sa.String(length=64), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('disputes', 'reason')
    op.drop_column('disputes', 'currency_code')
    op.drop_column('disputes', 'amount')
