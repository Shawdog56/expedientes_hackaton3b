"""Clasificación de documentos por tipo documental a partir del nombre del archivo.

Regla: el nombre debe contener el tipo documental en cualquier forma, sin importar
mayúsculas, acentos, prefijos numéricos ("01", "3.") ni texto adicional.
Si el nombre no basta, se usa el nombre de las carpetas que lo contienen.
"""

import re
import unicodedata
from dataclasses import dataclass, field

from app.domain.documentos import (  # noqa: F401  (reexportados para compatibilidad)
    AGENTE_POR_TIPO,
    ETIQUETAS,
    EstadoClasificacion,
    TipoDocumental,
)


# Patrones sobre el texto normalizado (minúsculas, sin acentos, solo letras/números/espacios).
PATRONES: dict[TipoDocumental, re.Pattern[str]] = {
    TipoDocumental.ESCRITURAS: re.compile(r"\bescritur"),
    TipoDocumental.PREDIAL: re.compile(r"\bpredial"),
    TipoDocumental.ALINEAMIENTO_NUMERO_OFICIAL: re.compile(
        r"\balinea|\b(numero|num|no) oficial\b"
    ),
    TipoDocumental.USO_SUELO: re.compile(r"\buso (de )?suelo"),
}


def normalizar(texto: str) -> str:
    """'03. Número Oficial_Sor-Juana.pdf' -> '03 numero oficial sor juana'."""
    texto = re.sub(r"\.pdf$", "", texto, flags=re.IGNORECASE)
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c)).lower()
    texto = re.sub(r"[^a-z0-9]+", " ", texto)
    return texto.strip()


def tipos_en(texto: str) -> list[TipoDocumental]:
    normal = normalizar(texto)
    return [tipo for tipo, patron in PATRONES.items() if patron.search(normal)]


@dataclass
class Clasificacion:
    tipo: TipoDocumental | None
    estado: EstadoClasificacion
    fuente: str | None = None  # "nombre" | "carpeta"
    candidatos: list[TipoDocumental] = field(default_factory=list)

    @property
    def agente(self) -> str | None:
        return AGENTE_POR_TIPO.get(self.tipo) if self.tipo else None


def clasificar(ruta: str) -> Clasificacion:
    """Clasifica por el nombre del archivo; si no hay coincidencia, por sus carpetas (de la más cercana a la raíz)."""
    partes = ruta.replace("\\", "/").split("/")
    nombre, carpetas = partes[-1], partes[:-1]

    candidatos = tipos_en(nombre)
    fuente = "nombre"
    if not candidatos:
        fuente = "carpeta"
        for carpeta in reversed(carpetas):
            candidatos = tipos_en(carpeta)
            if candidatos:
                break

    if len(candidatos) == 1:
        return Clasificacion(candidatos[0], EstadoClasificacion.CLASIFICADO, fuente, candidatos)
    if len(candidatos) > 1:
        return Clasificacion(None, EstadoClasificacion.AMBIGUO, fuente, candidatos)
    return Clasificacion(None, EstadoClasificacion.SIN_CLASIFICAR)
