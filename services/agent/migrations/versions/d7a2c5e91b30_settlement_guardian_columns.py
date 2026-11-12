"""settlement guardian columns

Revision ID: d7a2c5e91b30
Revises: c4f1a9d82e5b
Create Date: 2026-11-12 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'd7a2c5e91b30'
down_revision: Union[str, Sequence[str], None] = 'c4f1a9d82e5b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('settlements', sa.Column('recipient_email', sa.String(length=320), nullable=True))
    op.add_column('settlements', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('settlements', sa.Column('risk_score', sa.Numeric(4, 3), nullable=True))
    op.add_column('settlements', sa.Column('risk_flags', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('settlements', 'risk_flags')
    op.drop_column('settlements', 'risk_score')
    op.drop_column('settlements', 'description')
    op.drop_column('settlements', 'recipient_email')
