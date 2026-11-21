"""cifrado de campos sensibles (AES-256-GCM)

Revision ID: c3a91f5e7d24
Revises: b7e41c9d2a58
Create Date: 2026-11-21 20:00:00.000000

Pasa `extracciones.caracteristicas` y `hallazgos.evidencia` de JSONB a texto y cifra, junto con
`hallazgos.mensaje` y `validaciones_cruzadas.resumen`, las filas que ya existan. Solo pide
las claves de cifrado si hay filas que transformar.
"""
from collections.abc import Callable
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c3a91f5e7d24'
down_revision: Union[str, Sequence[str], None] = 'b7e41c9d2a58'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (tabla, columna, es JSONB antes de cifrar)
CAMPOS = [
    ('extracciones', 'caracteristicas', True),
    ('hallazgos', 'evidencia', True),
    ('hallazgos', 'mensaje', False),
    ('validaciones_cruzadas', 'resumen', False),
]


def _transformar(tabla: str, columna: str, funcion: Callable[[str], str]) -> None:
    conexion = op.get_bind()
    filas = conexion.execute(
        sa.text(f'SELECT id, {columna} FROM {tabla} WHERE {columna} IS NOT NULL')
    ).fetchall()
    for id_, valor in filas:
        conexion.execute(
            sa.text(f'UPDATE {tabla} SET {columna} = :valor WHERE id = :id'),
            {'valor': funcion(valor), 'id': id_},
        )


def _cifrar(contexto: str) -> Callable[[str], str]:
    from app.core.seguridad.proveedor import obtener_cifrador

    return lambda valor: obtener_cifrador().cifrar(valor.encode('utf-8'), contexto)


def _descifrar(contexto: str) -> Callable[[str], str]:
    from app.core.seguridad.proveedor import obtener_cifrador

    return lambda valor: obtener_cifrador().descifrar(valor, contexto).decode('utf-8')


def upgrade() -> None:
    """Upgrade schema."""
    for tabla, columna, es_json in CAMPOS:
        if es_json:
            op.alter_column(
                tabla, columna, type_=sa.Text(), existing_nullable=True,
                postgresql_using=f'{columna}::text',
            )
        _transformar(tabla, columna, _cifrar(f'{tabla}.{columna}'))


def downgrade() -> None:
    """Downgrade schema."""
    for tabla, columna, es_json in CAMPOS:
        _transformar(tabla, columna, _descifrar(f'{tabla}.{columna}'))
        if es_json:
            op.alter_column(
                tabla, columna, type_=sa.JSON().with_variant(
                    sa.dialects.postgresql.JSONB(), 'postgresql'
                ),
                existing_nullable=True, postgresql_using=f'{columna}::jsonb',
            )
