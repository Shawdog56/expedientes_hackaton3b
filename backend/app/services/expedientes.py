"""Carga de expedientes: validación de archivos, clasificación por tipo documental y persistencia.

Los documentos (PDF, JPG y PNG) viven en STORAGE_DIR/<expediente_id>/documentos/...; los metadatos en PostgreSQL.
"""

import hashlib
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.db.models import ArchivoRechazado, Documento, Expediente
from app.domain.documentos import EstadoClasificacion, TipoDocumental
from app.domain.estados import EstadoExtraccion
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
    expediente_id = uuid.uuid4()
    base = settings.storage_dir / expediente_id.hex
    documentos_dir = base / DIR_DOCUMENTOS

    try:
        resultados, hay_zip = _validar_archivos(archivos, base)
    except Exception:
        shutil.rmtree(base, ignore_errors=True)
        raise

    aceptados = [r for r in resultados if r.aceptado and r.destino]
    rechazados = [{"ruta": r.ruta, "motivo": r.motivo or ""} for r in resultados if not r.aceptado]

    if not aceptados:
        shutil.rmtree(base, ignore_errors=True)
        raise SinDocumentosValidos(rechazados)

    expediente = Expediente(
        id=expediente_id,
        nombre=(nombre or _nombre_por_defecto(archivos)).strip()[:255],
        origen="zip" if hay_zip else "carpeta",
    )
    for r in aceptados:
        assert r.destino is not None
        ruta = r.destino.relative_to(documentos_dir).as_posix()
        clasificacion = clasificar(ruta)
        expediente.documentos.append(
            Documento(
                nombre=r.destino.name,
                ruta=ruta,
                ruta_almacenamiento=str(r.destino),
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

    try:
        db.add(expediente)
        db.commit()
    except Exception:
        db.rollback()
        shutil.rmtree(base, ignore_errors=True)
        raise
    return obtener_expediente(db, expediente_id)


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


def documentos_para_agentes(db: Session, expediente_id: uuid.UUID) -> dict[str, list[Documento]]:
    """Agrupa por agente especialista los documentos clasificados pendientes de extracción."""
    expediente = obtener_expediente(db, expediente_id)
    por_agente: dict[str, list[Documento]] = {}
    for doc in expediente.documentos:
        if doc.agente and doc.estado_extraccion == EstadoExtraccion.PENDIENTE:
            por_agente.setdefault(doc.agente, []).append(doc)
    return por_agente
