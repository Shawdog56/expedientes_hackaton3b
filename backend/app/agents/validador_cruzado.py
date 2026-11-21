import json
from typing import Any

from app.agents.base import BaseAgent
from app.services.validador_cruzado import validar_expediente_cruzado
from app.services.validador_documento import validar_documento_individual


class ValidadorCruzadoAgent(BaseAgent):
    """Agente de auditoría integral y validación cruzada para expedientes de Tiendas 3B."""

    name = "validador_cruzado"
    description = (
        "Audita los 4 documentos del expediente (predial, escritura, uso de suelo, alineamiento), "
        "valida vigencia del predial, compatibilidad comercial, cruza claves catastrales y superficies, "
        "y emite el veredicto final con 5 niveles de confianza."
    )

    async def run(self, input: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        contexto = context or {}
        documentos_raw = contexto.get("documentos")

        # Si no viene en context, intentar leer desde input JSON
        if not documentos_raw and input.strip():
            try:
                parsed = json.loads(input)
                if isinstance(parsed, list):
                    documentos_raw = parsed
                elif isinstance(parsed, dict) and "documentos" in parsed:
                    documentos_raw = parsed["documentos"]
            except Exception:
                documentos_raw = []

        if not documentos_raw:
            return {
                "veredicto": "No Cumple",
                "confianza_veredicto": 100,
                "confianzas_por_documento": {
                    "predial": 0,
                    "escritura": 0,
                    "uso_de_suelo": 0,
                    "alineamiento_y_numero_oficial": 0,
                },
                "explicacion": "Error: No se proporcionaron documentos para auditar el expediente.",
                "hallazgos_criticos": [
                    {
                        "regla": "expediente_vacio",
                        "descripcion": "No se recibió ningún documento en la solicitud.",
                        "severidad": "CRITICO",
                    }
                ],
                "hallazgos_advertencias": [],
                "hallazgos_conformes": [],
            }

        anio_referencia = contexto.get("anio_referencia")

        # Asegurar que cada documento tenga la validación individual y normalización
        documentos_validados = []
        for doc in documentos_raw:
            if "campos_normalizados" not in doc:
                doc = validar_documento_individual(doc, anio_referencia=anio_referencia)
            documentos_validados.append(doc)

        resultado = validar_expediente_cruzado(
            documentos=documentos_validados,
            anio_referencia=anio_referencia,
        )
        return resultado
