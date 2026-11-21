"""Cifra los archivos del volumen que se guardaron antes de existir el cifrado.

    docker compose exec backend python scripts/cifrar_archivos_existentes.py

Para cada documento cuyo archivo siga en claro: lo cifra con un nombre aleatorio (`<id>.enc`), actualiza
`ruta_almacenamiento`, borra el archivo original y las carpetas que queden vacías (sus nombres también
revelan datos). Se puede repetir sin riesgo: los archivos ya cifrados se saltan.
"""

import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.seguridad.archivos import EXTENSION, cifrar_archivo, esta_cifrado  # noqa: E402
from app.db.models import Documento  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.services.expedientes import DIR_DOCUMENTOS, contexto_archivo  # noqa: E402


def _borrar_carpetas_vacias(desde: Path, raiz: Path) -> None:
    carpeta = desde
    while carpeta != raiz and carpeta.is_dir() and not any(carpeta.iterdir()):
        carpeta.rmdir()
        carpeta = carpeta.parent


def main() -> None:
    cifrados = saltados = faltantes = 0
    with SessionLocal() as db:
        for documento in db.scalars(select(Documento)):
            origen = Path(documento.ruta_almacenamiento)
            if not origen.is_file():
                faltantes += 1
                continue
            if esta_cifrado(origen):
                saltados += 1
                continue
            destino = (
                settings.storage_dir
                / documento.expediente_id.hex
                / DIR_DOCUMENTOS
                / f"{uuid.UUID(str(documento.id)).hex}{EXTENSION}"
            )
            cifrar_archivo(origen, destino, contexto_archivo(documento.id))
            documento.ruta_almacenamiento = str(destino)
            db.commit()  # primero queda registrado el archivo nuevo; después se borra el viejo
            origen.unlink()
            _borrar_carpetas_vacias(origen.parent, destino.parent)
            cifrados += 1
    print(f"Cifrados: {cifrados}. Ya cifrados: {saltados}. Sin archivo en disco: {faltantes}.")


if __name__ == "__main__":
    main()
