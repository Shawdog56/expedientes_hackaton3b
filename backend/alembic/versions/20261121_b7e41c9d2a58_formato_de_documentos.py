"""formato de documentos (pdf, jpeg, png)

Revision ID: b7e41c9d2a58
Revises: 902954263c86
Create Date: 2026-11-21 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b7e41c9d2a58'
down_revision: Union[str, Sequence[str], None] = '902954263c86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Los documentos existentes eran todos PDF.
    op.add_column(
        'documentos',
        sa.Column(
            'formato',
            sa.Enum('pdf', 'jpeg', 'png', name='formatoarchivo', native_enum=False, length=40),
            server_default='pdf',
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('documentos', 'formato')
