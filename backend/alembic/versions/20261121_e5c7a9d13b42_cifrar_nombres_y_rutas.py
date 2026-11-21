"""cifrar nombres y rutas de expedientes y documentos

Revision ID: e5c7a9d13b42
Revises: d4b8e2a61f90
Create Date: 2026-11-21 22:00:00.000000

Pasa a texto y cifra `expedientes.nombre`, `documentos.nombre`, `documentos.ruta` y
`archivos_rechazados.ruta`, porque los nombres de carpetas y archivos suelen incluir nombres de
personas y de predios. Solo pide las claves de cifrado si hay filas que transformar.

Los archivos que ya estén en el volumen no se tocan aquí: se cifran con
`scripts/cifrar_archivos_existentes.py`.
"""
from collections.abc import Callable
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e5c7a9d13b42'
down_revision: Union[str, Sequence[str], None] = 'd4b8e2a61f90'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (tabla, columna, largo original)
CAMPOS = [
    ('expedientes', 'nombre', 255),
    ('documentos', 'nombre', 255),
    ('documentos', 'ruta', 1024),
    ('archivos_rechazados', 'ruta', 1024),
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
    for tabla, columna, largo in CAMPOS:
        op.alter_column(
            tabla, columna, type_=sa.Text(), existing_type=sa.String(length=largo),
            existing_nullable=False,
        )
        _transformar(tabla, columna, _cifrar(f'{tabla}.{columna}'))


def downgrade() -> None:
    """Downgrade schema."""
    for tabla, columna, largo in CAMPOS:
        _transformar(tabla, columna, _descifrar(f'{tabla}.{columna}'))
        op.alter_column(
            tabla, columna, type_=sa.String(length=largo), existing_type=sa.Text(),
            existing_nullable=False,
        )
