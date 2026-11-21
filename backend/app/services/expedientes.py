"""Carga de expedientes: validación de archivos, clasificación por tipo documental y persistencia.

Los documentos (PDF, JPG y PNG) se guardan **cifrados** en STORAGE_DIR/<expediente_id>/documentos/<id>.enc,
con un nombre aleatorio: ni el nombre ni la ruta original aparecen en el disco. Los metadatos van en
PostgreSQL (el nombre y la ruta, también cifrados). Los archivos se validan en un directorio temporal
fuera del volumen, que se borra al terminar. Quien necesite leer un documento (visor, agentes) lo pide
descifrado con `documento_en_claro` o `contenido_de_documento`.
"""

import hashlib
import itertools
import shutil
import tempfile
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.seguridad.archivos import (
    EXTENSION,
    cifrar_archivo,
    descifrar_a_archivo,
    descifrar_flujo,
    esta_cifrado,
)
from app.core.seguridad.proveedor import obtener_cifrador
from app.db.models import ArchivoRechazado, Documento, Expediente, ahora
from app.domain.documentos import EstadoClasificacion, TipoDocumental
from app.domain.estados import DecisionFinal, EstadoExtraccion
from app.services.clasificacion import clasificar
from app.services.validacion import (
    ArchivoRechazado as Rechazo,
    ResultadoArchivo,
    es_ignorable,
    es_zip,
    guardar_documento,
    leer_cabecera,
    procesar_zip,
    sanear_ruta,
)

DIR_DOCUMENTOS = "documentos"


@dataclass
class ArchivoSubido:
    contenido: BinaryIO
    nombre: str
    ruta: str  # ruta relativa (carpetas) o el nombre del archivo


class SinDocumentosValidos(Exception):
    def __init__(self, rechazados: list[dict[str, str]]):
        super().__init__("No se encontró ningún documento válido")
        self.rechazados = rechazados


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def _validar_archivos(archivos: list[ArchivoSubido], base: Path) -> tuple[list[ResultadoArchivo], bool]:
    """Guarda en disco los documentos válidos (descomprimiendo ZIPs). Devuelve resultados y si hubo ZIP."""
    documentos_dir = base / DIR_DOCUMENTOS
    documentos_dir.mkdir(parents=True, exist_ok=True)
    resultados: list[ResultadoArchivo] = []
    hay_zip = False

    for i, archivo in enumerate(archivos):
        try:
            ruta = sanear_ruta(archivo.ruta or archivo.nombre)
        except Rechazo as e:
            resultados.append(ResultadoArchivo(archivo.nombre, motivo=e.motivo))
            continue
        if es_ignorable(ruta):
            continue

        if es_zip(ruta, leer_cabecera(archivo.contenido)):
            hay_zip = True
            resultados += procesar_zip(archivo.contenido, ruta, documentos_dir, base / f".tmp-{i}")
        else:
            resultados.append(guardar_documento(archivo.contenido, ruta, documentos_dir))
    return resultados, hay_zip


def _nombre_por_defecto(archivos: list[ArchivoSubido]) -> str:
    if not archivos:
        return "Expediente"
    primero = archivos[0].ruta or archivos[0].nombre
    nombre = primero.replace("\\", "/").split("/")[0]
    return nombre.removesuffix(".zip").removesuffix(".ZIP") or "Expediente"


def crear_expediente(db: Session, nombre: str | None, archivos: list[ArchivoSubido]) -> Expediente:
    """Valida, clasifica y registra el expediente. Lanza SinDocumentosValidos si no queda ningún documento."""
    obtener_cifrador()  # sin claves de cifrado no se guarda nada: falla antes de tocar el disco

    expediente_id = uuid.uuid4()
    base = settings.storage_dir / expediente_id.hex
    destino_dir = base / DIR_DOCUMENTOS

    try:
        with tempfile.TemporaryDirectory(prefix="exp-") as temporal:
            # Los archivos en claro solo existen aquí; al salir del bloque se borran.
            staging = Path(temporal)
            resultados, hay_zip = _validar_archivos(archivos, staging)

            aceptados = [r for r in resultados if r.aceptado and r.destino]
            rechazados = [{"ruta": r.ruta, "motivo": r.motivo or ""} for r in resultados if not r.aceptado]
            if not aceptados:
                raise SinDocumentosValidos(rechazados)

            expediente = Expediente(
                id=expediente_id,
                nombre=(nombre or _nombre_por_defecto(archivos)).strip()[:255],
                origen="zip" if hay_zip else "carpeta",
            )
            for r in aceptados:
                assert r.destino is not None
                ruta = r.destino.relative_to(staging / DIR_DOCUMENTOS).as_posix()
                clasificacion = clasificar(ruta)
                documento_id = uuid.uuid4()
                cifrado = destino_dir / f"{documento_id.hex}{EXTENSION}"
                cifrar_archivo(r.destino, cifrado, contexto_archivo(documento_id))
                expediente.documentos.append(
                    Documento(
                        id=documento_id,
                        nombre=r.destino.name,
                        ruta=ruta,
                        ruta_almacenamiento=str(cifrado),
                        tamano=r.tamano,
                        paginas=r.paginas,
                        formato=r.formato,
                        sha256=_sha256(r.destino),
                        tipo_documental=clasificacion.tipo,
                        estado_clasificacion=clasificacion.estado,
                        fuente_clasificacion=clasificacion.fuente,
                        estado_extraccion=(
                            EstadoExtraccion.PENDIENTE if clasificacion.tipo else EstadoExtraccion.NO_APLICA
                        ),
                    )
                )
            expediente.rechazados = [ArchivoRechazado(**r) for r in rechazados]

        db.add(expediente)
        db.commit()
    except Exception:
        db.rollback()
        shutil.rmtree(base, ignore_errors=True)
        raise
    return obtener_expediente(db, expediente_id)


def contexto_archivo(documento_id: uuid.UUID) -> str:
    """Contexto de cifrado del archivo: liga el contenido a su documento."""
    return f"documentos.archivo:{documento_id}"


@contextmanager
def documento_en_claro(documento: Documento) -> Iterator[Path]:
    """Entrega la ruta de una copia en claro del documento, que se borra al salir del bloque.

    Es la forma de leer un documento desde los agentes de extracción: ellos reciben una ruta, como
    siempre, y no tocan las claves. Los archivos anteriores al cifrado se entregan tal cual.
    """
    origen = Path(documento.ruta_almacenamiento)
    if not esta_cifrado(origen):
        yield origen
        return
    with tempfile.TemporaryDirectory(prefix="doc-") as temporal:
        copia = Path(temporal) / f"documento.{documento.formato.value}"
        descifrar_a_archivo(origen, copia, contexto_archivo(documento.id))
        yield copia


def _leer_en_claro(ruta: Path) -> Iterator[bytes]:
    with open(ruta, "rb") as f:
        while bloque := f.read(1024 * 1024):
            yield bloque


def contenido_de_documento(db: Session, documento_id: uuid.UUID) -> tuple[Documento, Iterator[bytes]]:
    """Contenido en claro del documento por bloques, para el visor. No se vuelca entero a memoria.

    Lanza LookupError si el documento o su archivo no existen y DescifradoError si el archivo está alterado.
    """
    ruta, documento = archivo_de_documento(db, documento_id)
    if esta_cifrado(ruta):
        flujo = descifrar_flujo(ruta, contexto_archivo(documento.id))
    else:  # archivos anteriores al cifrado
        flujo = _leer_en_claro(ruta)
    # Se lee el primer bloque ya, para detectar un archivo alterado antes de responder.
    primero = next(flujo, b"")
    return documento, itertools.chain([primero], flujo)


def _consulta_expediente():
    return select(Expediente).options(
        selectinload(Expediente.documentos), selectinload(Expediente.rechazados)
    )


def obtener_expediente(db: Session, expediente_id: uuid.UUID) -> Expediente:
    expediente = db.scalar(_consulta_expediente().where(Expediente.id == expediente_id))
    if expediente is None:
        raise LookupError(expediente_id)
    return expediente


def listar_expedientes(db: Session) -> list[Expediente]:
    return list(db.scalars(_consulta_expediente().order_by(Expediente.creado_en.desc())))


def eliminar_expediente(db: Session, expediente_id: uuid.UUID) -> None:
    expediente = obtener_expediente(db, expediente_id)
    db.delete(expediente)
    db.commit()
    shutil.rmtree(settings.storage_dir / expediente_id.hex, ignore_errors=True)


def reclasificar_documento(
    db: Session, documento_id: uuid.UUID, tipo: TipoDocumental | None
) -> Expediente:
    """Asignación manual del tipo documental (para documentos sin clasificar o ambiguos)."""
    documento = db.get(Documento, documento_id)
    if documento is None:
        raise LookupError(documento_id)
    documento.tipo_documental = tipo
    if tipo is None:
        documento.estado_clasificacion = EstadoClasificacion.SIN_CLASIFICAR
        documento.fuente_clasificacion = None
        documento.estado_extraccion = EstadoExtraccion.NO_APLICA
    else:
        documento.estado_clasificacion = EstadoClasificacion.MANUAL
        documento.fuente_clasificacion = "manual"
        documento.estado_extraccion = EstadoExtraccion.PENDIENTE
    db.commit()
    return obtener_expediente(db, documento.expediente_id)


def archivo_de_documento(db: Session, documento_id: uuid.UUID) -> tuple[Path, Documento]:
    """Ruta en disco del documento para visualizarlo. Solo sirve archivos dentro del volumen de expedientes."""
    documento = db.get(Documento, documento_id)
    if documento is None:
        raise LookupError(documento_id)
    ruta = Path(documento.ruta_almacenamiento).resolve()
    if not ruta.is_relative_to(settings.storage_dir.resolve()) or not ruta.is_file():
        raise LookupError(documento_id)
    return ruta, documento


def decidir_expediente(
    db: Session, expediente_id: uuid.UUID, decision: DecisionFinal, por: str | None
) -> Expediente:
    """Registra la decisión final de la persona que revisa. La última decisión reemplaza a la anterior."""
    expediente = obtener_expediente(db, expediente_id)
    expediente.decision_final = decision
    expediente.decidido_en = ahora()
    expediente.decidido_por = por
    db.commit()
    return obtener_expediente(db, expediente_id)


def documentos_para_agentes(db: Session, expediente_id: uuid.UUID) -> dict[str, list[Documento]]:
    """Agrupa por agente especialista los documentos clasificados pendientes de extracción."""
    expediente = obtener_expediente(db, expediente_id)
    por_agente: dict[str, list[Documento]] = {}
    for doc in expediente.documentos:
        if doc.agente and doc.estado_extraccion == EstadoExtraccion.PENDIENTE:
            por_agente.setdefault(doc.agente, []).append(doc)
    return por_agente
