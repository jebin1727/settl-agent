"""use clock_timestamp for created_at/updated_at defaults

Revision ID: a013823b841c
Revises: 73620a97cec2
Create Date: 2026-11-03 11:18:32.334282

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a013823b841c'
down_revision: Union[str, Sequence[str], None] = '73620a97cec2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


COLUMNS = [
    ("settlements", "created_at"),
    ("settlements", "updated_at"),
    ("disputes", "created_at"),
    ("audit_logs", "created_at"),
]


def upgrade() -> None:
    # alembic autogenerate doesn't diff server_default text by default
    # (needs compare_server_default=True), so this is hand-written —
    # see SA-Arch.md / models/settlement.py for why clock_timestamp()
    # replaces now(): now() is frozen at transaction start in Postgres.
    for table, column in COLUMNS:
        op.alter_column(table, column, server_default=sa.text("clock_timestamp()"))


def downgrade() -> None:
    for table, column in COLUMNS:
        op.alter_column(table, column, server_default=sa.text("now()"))
