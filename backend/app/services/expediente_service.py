import asyncio
from typing import Any, Optional

from app.agents.clasificador import ClasificadorAgent
from app.services.validador_cruzado import validar_expediente_cruzado
from app.services.validador_documento import validar_documento_individual


class ExpedienteService:
    """Orquestador integral del flujo de auditoría de expedientes de Tiendas 3B."""

    def __init__(self, clasificador: Optional[Any] = None) -> None:
        # Inyección de dependencias para permitir mocks limpios en pruebas
        self.clasificador = clasificador or ClasificadorAgent()

    async def analizar_expediente(
        self,
        textos: list[str],
        anio_referencia: Optional[int] = None,
    ) -> dict[str, Any]:
        """Ejecuta el pipeline completo:

        1. Clasificación y extracción LangChain en paralelo (xN).
        2. Validación individual y normalización de campos indispensables.
        3. Auditoría integral cruzada de expediente, 5 confianzas y veredicto final.
        """
        # Paso 1: Clasificación y extracción concurrente con LangChain
        tareas = [self.clasificador.run(t) for t in textos]
        resultados_clasificacion = await asyncio.gather(*tareas)

        # Paso 2: Validación individual y normalización determinista
        documentos_procesados = [
            validar_documento_individual(doc, anio_referencia=anio_referencia)
            for doc in resultados_clasificacion
        ]

        # Paso 3: Validación cruzada de expediente, veredicto y reporte
        dictamen = validar_expediente_cruzado(
            documentos=documentos_procesados,
            anio_referencia=anio_referencia,
        )

        return {
            **dictamen,
            "documentos": documentos_procesados,
        }
