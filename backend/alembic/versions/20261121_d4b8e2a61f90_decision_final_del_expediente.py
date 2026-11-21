"""decisión final del expediente

Revision ID: d4b8e2a61f90
Revises: c3a91f5e7d24
Create Date: 2026-11-21 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd4b8e2a61f90'
down_revision: Union[str, Sequence[str], None] = 'c3a91f5e7d24'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'expedientes',
        sa.Column(
            'decision_final',
            sa.Enum('aceptado', 'rechazado', name='decisionfinal', native_enum=False, length=40),
            nullable=True,
        ),
    )
    op.add_column('expedientes', sa.Column('decidido_en', sa.DateTime(timezone=True), nullable=True))
    op.add_column('expedientes', sa.Column('decidido_por', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('expedientes', 'decidido_por')
    op.drop_column('expedientes', 'decidido_en')
    op.drop_column('expedientes', 'decision_final')
