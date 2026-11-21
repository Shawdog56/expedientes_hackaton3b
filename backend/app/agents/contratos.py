"""Contrato de los agentes especialistas de extracción.

Un agente especialista no conoce la base de datos, la API ni a otros agentes: recibe
una `SolicitudExtraccion` (qué archivo leer, en qué formato y de qué tipo es) y devuelve un
`ResultadoExtraccion` (qué características encontró). Quien orquesta se encarga de
leer el expediente, persistir el resultado y decidir qué hacer con los errores.

Un agente solo puede importar `app.domain`, `app.agents.base` y este módulo.
"""

from abc import abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, ClassVar

from app.agents.base import BaseAgent
from app.domain.documentos import FormatoArchivo, TipoDocumental


@dataclass(frozen=True)
class SolicitudExtraccion:
    documento_id: str
    ruta_archivo: Path
    formato: FormatoArchivo  # PDF: leer texto y páginas; imagen (JPEG/PNG): visión u OCR
    nombre: str
    tipo: TipoDocumental
    paginas: int


@dataclass
class ResultadoExtraccion:
    # Características extraídas, p. ej. {"folio": "...", "propietario": "..."}
    caracteristicas: dict[str, Any]
    confianza: float | None = None
    advertencias: list[str] = field(default_factory=list)


class AgenteExtractor(BaseAgent):
    """Base de los agentes especialistas. Subclases: definir `name`, `tipo_documental` y `extraer`."""

    tipo_documental: ClassVar[TipoDocumental]

    @abstractmethod
    async def extraer(self, solicitud: SolicitudExtraccion) -> ResultadoExtraccion:
        """Lee el archivo de la solicitud y devuelve sus características. Los fallos se lanzan como excepción."""

    async def run(self, input: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        # Un extractor lee archivos del almacenamiento: no se expone por el endpoint genérico
        # de `run` (aceptaría rutas arbitrarias). Se invoca siempre mediante `extraer`.
        raise NotImplementedError("Los agentes extractores se invocan con extraer(), no con run()")
