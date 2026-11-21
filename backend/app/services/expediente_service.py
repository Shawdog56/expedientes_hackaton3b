from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any, BinaryIO, Callable, Optional

try:
    from app.agents.clasificador import ClasificadorAgent
except ImportError:
    ClasificadorAgent = None
from app.agents.ocr import OCRAgent
from app.core.concurrencia import PoolDeRecursos
from app.core.config import settings
from app.services.validador_cruzado import validar_expediente_cruzado
from app.services.validador_documento import validar_documento_individual

_pool: PoolDeRecursos[Any] | None = None
# Turno de OCR: un documento a la vez (el motor es compartido). Ser explícito permite saber cuándo
# empieza a leerse cada documento y mostrarlo en el progreso.
_turno_ocr: PoolDeRecursos[None] = PoolDeRecursos([None])

# Fases de un documento durante la auditoría, en orden.
EN_ESPERA = "en_espera"
LEYENDO = "leyendo"
ESPERANDO_MODELO = "esperando_modelo"
ANALIZANDO = "analizando"
LISTO = "listo"


def pool_clasificadores() -> PoolDeRecursos[Any]:
    """Un clasificador por instancia de Ollama, compartido por todas las peticiones del proceso.

    Cada clasificador atiende una petición a la vez: con dos instancias se procesan dos
    documentos al mismo tiempo, venga cada uno del lote o de peticiones distintas, y el resto espera.
    """
    global _pool
    if _pool is None:
        if ClasificadorAgent is None:
            raise ImportError("ClasificadorAgent requiere langchain_core y langchain_ollama instalados.")
        _pool = PoolDeRecursos([ClasificadorAgent(base_url=url) for url in settings.ollama_base_urls])
    return _pool


class ExpedienteService:
    """Orquestador integral del flujo de auditoría de expedientes de Tiendas 3B."""

    def __init__(
        self,
        clasificador: Optional[Any] = None,
        ocr_agent: Optional[Any] = None,
    ) -> None:
        # Con un clasificador inyectado (pruebas) se usa ese; si no, el pool de instancias de Ollama.
        if clasificador is None and ClasificadorAgent is None:
            raise ImportError("ClasificadorAgent requiere langchain_core y langchain_ollama instalados.")
        self.clasificador = clasificador
        self.ocr_agent = ocr_agent or OCRAgent()

    async def _clasificar(
        self,
        texto: str,
        context: dict[str, Any] | None = None,
        al_obtener_modelo: Optional[Callable[[], None]] = None,
    ) -> dict[str, Any]:
        if self.clasificador is not None:
            if al_obtener_modelo:
                al_obtener_modelo()
            return await self.clasificador.run(texto, context=context)
        async with pool_clasificadores().usar() as clasificador:
            if al_obtener_modelo:
                al_obtener_modelo()
            return await clasificador.run(texto, context=context)

    async def extraer_y_clasificar_documento(
        self,
        archivo: Path | str | bytes | BinaryIO,
        nombre: str = "",
        al_cambiar_fase: Optional[Callable[[str], None]] = None,
    ) -> dict[str, Any]:
        """Extrae el texto de un documento mediante el agente OCR y lo transporta

        al ClasificadorAgent para su clasificación y extracción estructurada.
        `al_cambiar_fase` recibe leyendo, esperando_modelo y analizando a medida que avanza.
        """

        def fase(nombre_fase: str) -> None:
            if al_cambiar_fase is not None:
                al_cambiar_fase(nombre_fase)

        # Paso 1: Recuperar texto y metadatos con el agente OCR. Corre en un hilo: es trabajo de CPU
        # síncrono y, en el bucle principal, bloquearía las demás peticiones mientras dura.
        async with _turno_ocr.usar():
            fase(LEYENDO)
            resultado_ocr = await asyncio.to_thread(self.ocr_agent.extraer_texto, archivo, nombre=nombre)
        texto_extraido = resultado_ocr.get("texto", "").strip()

        # Paso 2: Transportar el texto al agente clasificador (una instancia de Ollama libre)
        fase(ESPERANDO_MODELO)
        resultado_clasificacion = await self._clasificar(
            texto_extraido,
            context={
                "ocr": resultado_ocr,
                "nombre_archivo": nombre or resultado_ocr.get("archivo", ""),
            },
            al_obtener_modelo=lambda: fase(ANALIZANDO),
        )

        # Paso 3: Enriquecer con metadatos del OCR
        resultado_clasificacion["archivo"] = nombre or resultado_ocr.get("archivo", "")
        resultado_clasificacion["ocr_metadatos"] = {
            "metodo": resultado_ocr.get("metodo", "desconocido"),
            "paginas": resultado_ocr.get("paginas", 0),
            "bloques_detectados": len(resultado_ocr.get("bloques", [])),
            "advertencias": resultado_ocr.get("advertencias", []),
        }

        return resultado_clasificacion

    async def auditar_archivos(
        self,
        archivos: list[tuple[str, Path | bytes | BinaryIO]],
        anio_referencia: Optional[int] = None,
        al_avanzar: Optional[Callable[[dict[str, Any]], None]] = None,
    ) -> dict[str, Any]:
        """Flujo completo desde archivos físicos o subidos:

        1. OCR paralelo en cada archivo (PDF, JPG, PNG, TXT).
        2. Clasificación y extracción LangChain (ClasificadorAgent).
        3. Validación individual determinista (reglas de negocio Tiendas 3B).
        4. Auditoría cruzada integral, matriz de coherencia y veredicto.
        """
        if not archivos:
            return {
                "veredicto": "No Cumple",
                "confianza_veredicto": 100,
                "confianzas_por_documento": {
                    "predial": 0,
                    "escritura": 0,
                    "uso_de_suelo": 0,
                    "alineamiento_y_numero_oficial": 0,
                },
                "explicacion": "No se recibieron archivos para auditar.",
                "hallazgos_criticos": [
                    {
                        "regla": "expediente_vacio",
                        "descripcion": "No se subieron archivos al expediente.",
                        "severidad": "CRITICO",
                    }
                ],
                "documentos": [],
            }

        # `al_avanzar` recibe el progreso (etapa y documentos listos) para mostrarlo en la interfaz.
        def avisar(**evento: Any) -> None:
            if al_avanzar is not None:
                al_avanzar({"documentos_total": len(archivos), **evento})

        listos = 0

        async def procesar(indice: int, nombre: str, contenido: Any) -> dict[str, Any]:
            nonlocal listos
            resultado = await self.extraer_y_clasificar_documento(
                contenido,
                nombre=nombre,
                al_cambiar_fase=lambda f: avisar(etapa="extraer", documentos_listos=listos, documento_fase=(indice, f)),
            )
            listos += 1
            avisar(etapa="extraer", documentos_listos=listos, documento_fase=(indice, LISTO))
            return resultado

        # Ejecución concurrente del OCR + Clasificador por archivo (gather conserva el orden)
        tareas = [procesar(i, nombre, contenido) for i, (nombre, contenido) in enumerate(archivos)]
        documentos_clasificados = await asyncio.gather(*tareas)

        # Validación individual y normalización
        avisar(etapa="validar_reglas", documentos_listos=listos)
        documentos_procesados = [
            validar_documento_individual(doc, anio_referencia=anio_referencia)
            for doc in documentos_clasificados
        ]

        # Validación cruzada del expediente
        avisar(etapa="validacion_cruzada", documentos_listos=listos)
        dictamen = validar_expediente_cruzado(
            documentos=documentos_procesados,
            anio_referencia=anio_referencia,
        )

        return {
            **dictamen,
            "documentos": documentos_procesados,
        }

    async def analizar_expediente(
        self,
        textos: list[str],
        anio_referencia: Optional[int] = None,
    ) -> dict[str, Any]:
        """Ejecuta el pipeline sobre una lista de textos pre-extraídos:

        1. Clasificación y extracción LangChain en paralelo (xN).
        2. Validación individual y normalización de campos indispensables.
        3. Auditoría integral cruzada de expediente, 5 confianzas y veredicto final.
        """
        # Paso 1: Clasificación y extracción concurrente con LangChain
        tareas = [self._clasificar(t) for t in textos]
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
