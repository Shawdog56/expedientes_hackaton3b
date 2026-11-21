"""Estados del flujo: carga -> clasificación -> extracción -> validación cruzada -> verificación."""

from enum import StrEnum


class EstadoExpediente(StrEnum):
    CARGADO = "cargado"  # archivos validados y clasificados
    EN_EXTRACCION = "en_extraccion"  # agentes especialistas trabajando
    EN_VALIDACION = "en_validacion"  # orquestador haciendo validación cruzada
    VERIFICADO = "verificado"
    ERROR = "error"


class DecisionFinal(StrEnum):
    """Decisión de la persona que revisa el expediente, al final del flujo."""

    ACEPTADO = "aceptado"
    RECHAZADO = "rechazado"


class EstadoExtraccion(StrEnum):
    PENDIENTE = "pendiente"
    EN_PROCESO = "en_proceso"
    COMPLETADA = "completada"
    ERROR = "error"
    NO_APLICA = "no_aplica"  # documento sin clasificar: no se envía a ningún agente


class ResultadoValidacion(StrEnum):
    CUMPLE = "cumple"
    REQUIERE_REVISION = "requiere_revision"
    NO_CUMPLE = "no_cumple"
