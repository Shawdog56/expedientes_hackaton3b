"""Auditorías de expedientes en segundo plano, con progreso consultable.

Una auditoría (OCR + modelo de lenguaje + validación cruzada) tarda minutos. La interfaz la inicia,
consulta el progreso cada pocos segundos y recibe el resultado al terminar. El estado vive en memoria
del proceso: se pierde si el backend se reinicia, y entonces la auditoría se vuelve a lanzar.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from contextlib import ExitStack
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable

from app.core.seguridad.errores import ErrorSeguridad
from app.db.models import Documento
from app.services import expedientes as svc
from app.services.expediente_service import ANALIZANDO, EN_ESPERA, LEYENDO, LISTO, ExpedienteService

logger = logging.getLogger(__name__)

EN_PROCESO = "en_proceso"
COMPLETADA = "completada"
ERROR = "error"
EN_CURSO = {LEYENDO, ANALIZANDO}


def _ahora() -> str:
    return datetime.now(UTC).isoformat()


@dataclass
class EstadoAuditoria:
    expediente_id: str
    documentos_ids: list[str]
    estado: str = EN_PROCESO
    etapa: str = "extraer"
    documentos_listos: int = 0
    # Fase de cada documento, en el mismo orden que documentos_ids:
    # en_espera, leyendo (OCR), esperando_modelo, analizando (modelo) o listo.
    fases: list[str] = field(default_factory=list)
    resultado: dict[str, Any] | None = None
    error: str | None = None
    iniciada_en: str = field(default_factory=_ahora)
    terminada_en: str | None = None

    def __post_init__(self) -> None:
        if not self.fases:
            self.fases = [EN_ESPERA] * len(self.documentos_ids)

    def como_dict(self) -> dict[str, Any]:
        return {
            "expediente_id": self.expediente_id,
            "estado": self.estado,
            "etapa": self.etapa,
            "documentos_total": len(self.documentos_ids),
            "documentos_listos": self.documentos_listos,
            "documentos": [{"id": i, "fase": f} for i, f in zip(self.documentos_ids, self.fases)],
            "documentos_en_curso": [i for i, f in zip(self.documentos_ids, self.fases) if f in EN_CURSO],
            "en_cola_delante": _delante_de(self),
            "resultado": self.resultado,
            "error": self.error,
            "iniciada_en": self.iniciada_en,
            "terminada_en": self.terminada_en,
        }


_auditorias: dict[uuid.UUID, EstadoAuditoria] = {}
_tareas: set[asyncio.Task[None]] = set()  # referencia fuerte: si no, el recolector puede cancelarlas


def obtener(expediente_id: uuid.UUID) -> EstadoAuditoria | None:
    return _auditorias.get(expediente_id)


def _delante_de(estado: EstadoAuditoria) -> int:
    """Auditorías en curso que empezaron antes: comparten el OCR y el modelo, así que van delante."""
    if estado.estado != EN_PROCESO:
        return 0
    return sum(
        1
        for otra in _auditorias.values()
        if otra is not estado and otra.estado == EN_PROCESO and otra.iniciada_en < estado.iniciada_en
    )


def _mensaje_de_error(exc: BaseException) -> str:
    """Mensaje para la interfaz, sin datos de los documentos."""
    if isinstance(exc, ErrorSeguridad):
        return "No se pudo leer un archivo del expediente: está alterado o falta su clave de cifrado."
    nombre = type(exc).__name__.lower()
    if "connect" in nombre or "timeout" in nombre or "protocol" in nombre:
        return "El modelo de lenguaje no respondió. Revisa que el contenedor de Ollama esté en marcha."
    return "No se pudo completar la auditoría. Revisa los registros del backend."


async def _ejecutar(
    estado: EstadoAuditoria,
    documentos: list[Documento],
    anio_referencia: int | None,
    crear_servicio: Callable[[], Any],
) -> None:
    def al_avanzar(evento: dict[str, Any]) -> None:
        estado.etapa = evento.get("etapa", estado.etapa)
        estado.documentos_listos = evento.get("documentos_listos", estado.documentos_listos)
        if "documento_fase" in evento:
            indice, fase = evento["documento_fase"]
            if 0 <= indice < len(estado.fases):
                estado.fases[indice] = fase

    try:
        # Los archivos del volumen están cifrados: se auditan copias temporales en claro que se
        # borran al salir del bloque, aunque la auditoría falle.
        with ExitStack() as copias:
            entradas = [(doc.nombre, copias.enter_context(svc.documento_en_claro(doc))) for doc in documentos]
            resultado = await crear_servicio().auditar_archivos(
                archivos=entradas, anio_referencia=anio_referencia, al_avanzar=al_avanzar
            )
        # El resultado conserva el orden de los archivos: se le agrega el id de cada documento.
        for documento, procesado in zip(documentos, resultado.get("documentos", [])):
            procesado["documento_id"] = str(documento.id)
        estado.resultado = resultado
        estado.etapa = "dictamen"
        estado.estado = COMPLETADA
    except Exception as exc:
        logger.exception("Falló la auditoría del expediente %s", estado.expediente_id)
        estado.error = _mensaje_de_error(exc)
        # Ningún documento queda marcado como en curso si la auditoría se detuvo.
        estado.fases = [f if f == LISTO else EN_ESPERA for f in estado.fases]
        estado.estado = ERROR
    finally:
        estado.terminada_en = _ahora()


def iniciar(
    expediente_id: uuid.UUID,
    documentos: list[Documento],
    anio_referencia: int | None = None,
    crear_servicio: Callable[[], Any] | None = None,
) -> EstadoAuditoria:
    """Lanza la auditoría en segundo plano. Si ya hay una en curso para el expediente, la devuelve.

    `documentos` son los del expediente, ya cargados. Lanza LookupError si ninguno tiene archivo en disco.
    """
    actual = _auditorias.get(expediente_id)
    if actual is not None and actual.estado == EN_PROCESO:
        return actual

    disponibles = [doc for doc in documentos if Path(doc.ruta_almacenamiento).is_file()]
    if not disponibles:
        raise LookupError(expediente_id)

    estado = EstadoAuditoria(
        expediente_id=str(expediente_id), documentos_ids=[str(doc.id) for doc in disponibles]
    )
    _auditorias[expediente_id] = estado
    tarea = asyncio.get_running_loop().create_task(
        _ejecutar(estado, disponibles, anio_referencia, crear_servicio or ExpedienteService)
    )
    _tareas.add(tarea)
    tarea.add_done_callback(_tareas.discard)
    return estado
