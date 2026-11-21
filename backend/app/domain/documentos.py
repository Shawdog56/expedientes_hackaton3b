"""Tipos documentales y su clasificación, independientes de cualquier capa."""

from enum import StrEnum


class TipoDocumental(StrEnum):
    ESCRITURAS = "escrituras"
    PREDIAL = "predial"
    ALINEAMIENTO_NUMERO_OFICIAL = "alineamiento_numero_oficial"
    USO_SUELO = "uso_suelo"


class FormatoArchivo(StrEnum):
    """Formato real del documento (según su contenido, no su extensión)."""

    PDF = "pdf"
    JPEG = "jpeg"
    PNG = "png"


class EstadoClasificacion(StrEnum):
    CLASIFICADO = "clasificado"
    SIN_CLASIFICAR = "sin_clasificar"
    AMBIGUO = "ambiguo"
    MANUAL = "manual"


ETIQUETAS: dict[TipoDocumental, str] = {
    TipoDocumental.ESCRITURAS: "Escrituras",
    TipoDocumental.PREDIAL: "Predial",
    TipoDocumental.ALINEAMIENTO_NUMERO_OFICIAL: "Alineamiento y Número Oficial",
    TipoDocumental.USO_SUELO: "Uso de Suelo",
}

# Contrato entre clasificación y agentes: nombre del agente especialista de cada tipo.
# Cada agente declara su `tipo_documental` y su `name` debe coincidir con esta tabla
# (lo comprueba el registro al descubrirlo).
AGENTE_POR_TIPO: dict[TipoDocumental, str] = {
    TipoDocumental.ESCRITURAS: "agente_escrituras",
    TipoDocumental.PREDIAL: "agente_predial",
    TipoDocumental.ALINEAMIENTO_NUMERO_OFICIAL: "agente_alineamiento",
    TipoDocumental.USO_SUELO: "agente_uso_suelo",
}
