from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any, BinaryIO, Optional

try:
    from app.agents.clasificador import ClasificadorAgent
except ImportError:
    ClasificadorAgent = None
from app.agents.ocr import OCRAgent
from app.services.validador_cruzado import validar_expediente_cruzado
from app.services.validador_documento import validar_documento_individual


class ExpedienteService:
    """Orquestador integral del flujo de auditoría de expedientes de Tiendas 3B."""

    def __init__(
        self,
        clasificador: Optional[Any] = None,
        ocr_agent: Optional[Any] = None,
    ) -> None:
        if clasificador is None:
            if ClasificadorAgent is None:
                raise ImportError(
                    "ClasificadorAgent requiere langchain_core y langchain_ollama instalados."
                )
            self.clasificador = ClasificadorAgent()
        else:
            self.clasificador = clasificador
        self.ocr_agent = ocr_agent or OCRAgent()

    async def extraer_y_clasificar_documento(
        self,
        archivo: Path | str | bytes | BinaryIO,
        nombre: str = "",
    ) -> dict[str, Any]:
        """Extrae el texto de un documento mediante el agente OCR y lo transporta

        al ClasificadorAgent para su clasificación y extracción estructurada.
        """
        # Paso 1: Recuperar texto y metadatos con el agente OCR
        resultado_ocr = self.ocr_agent.extraer_texto(archivo, nombre=nombre)
        texto_extraido = resultado_ocr.get("texto", "").strip()

        # Paso 2: Transportar el texto al agente clasificador
        resultado_clasificacion = await self.clasificador.run(
            texto_extraido,
            context={
                "ocr": resultado_ocr,
                "nombre_archivo": nombre or resultado_ocr.get("archivo", ""),
            },
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

        # Ejecución concurrente del OCR + Clasificador por archivo
        tareas = [
            self.extraer_y_clasificar_documento(contenido, nombre=nombre)
            for nombre, contenido in archivos
        ]
        documentos_clasificados = await asyncio.gather(*tareas)

        # Validación individual y normalización
        documentos_procesados = [
            validar_documento_individual(doc, anio_referencia=anio_referencia)
            for doc in documentos_clasificados
        ]

        # Validación cruzada del expediente
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
