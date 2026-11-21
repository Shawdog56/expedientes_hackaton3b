import re
from typing import Any, Type

from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama
from pydantic import BaseModel

from app.agents.base import BaseAgent
from app.core.config import settings
from app.schemas.documentos import (
    CamposAlineamiento,
    CamposEscritura,
    CamposPredial,
    CamposUsoSuelo,
    ClasificacionDocumento,
    ResultadoDocumento,
    TipoDocumento,
)

# ---------------------------------------------------------------------------
# Prompts de Sistema para LangChain
# ---------------------------------------------------------------------------

PROMPT_SISTEMA_CLASIFICACION = """Eres un clasificador documental inmobiliario y catastral de México para auditoría de expedientes de tiendas de conveniencia.

Tu tarea:
1. Generar un resumen conciso (2-3 líneas) del contenido y objetivo del documento.
2. Identificar evidencia textual directa.
3. Evaluar conflictos o ruido de OCR.
4. Clasificar el texto en exactamente una de estas 5 clases:
   - predial: boleta, recibo de pago, estado de cuenta o liquidación del impuesto predial.
   - escritura: escritura pública notarial, testimonio, protocolización, relotificación o sentencia judicial definitiva de adjudicación / información de dominio.
   - alineamiento y número oficial: constancia o cédula municipal de asignación de número oficial y/o alineamiento vial.
   - uso de suelo: licencia, constancia o dictamen de uso de suelo, zonificación o compatibilidad urbanística.
   - ninguna: no corresponde a ninguna de las anteriores, es ilegible o texto sin sentido.

REGLA DE CONTEXTO CRUZADO:
Una escritura suele citar como antecedente la boleta predial o el uso de suelo. Clasifica siempre por la naturaleza PRINCIPAL del documento que se está emitiendo, no por lo que menciona como antecedente.

RÚBRICA DE CONFIANZA LLM (0 a 100):
- 95 a 100: Encabezado/título oficial explícito y vocabulario inequívoco de la clase, sin contradicciones.
- 80 a 94: Documento claro pero con ruido de OCR o menciones cruzadas de antecedentes.
- 60 a 79: Fragmento parcial sin encabezado pero deducible por términos técnicos.
- 0 a 59: Ambiguo, texto insuficiente o clasificado como 'ninguna'."""

PROMPT_EXTRAER_PREDIAL = """Eres un extractor experto en documentos fiscales inmobiliarios de México.
Extrae con precisión las características del comprobante o boleta de PAGO DE PREDIAL del texto proporcionado.

Instrucciones:
- Extrae la clave catastral completa (sin modificar los dígitos).
- Determina si es un COMPROBANTE DE PAGO VÁLIDO (True si dice 'PAGADO', tiene folio de recibo de caja, sello digital SAT/CFDI o certificación bancaria; False si es solo formato de ventanilla / línea de captura sin certificar).
- Para importes y superficies, extrae solo el valor numérico flotante.
- Si un campo no está presente o no es legible en el texto, deja su valor en null. No inventes datos."""

PROMPT_EXTRAER_ESCRITURA = """Eres un perito legal inmobiliario en México.
Extrae con precisión las características vitales de la ESCRITURA PÚBLICA o TÍTULO DE PROPIEDAD del texto.

Instrucciones:
- Identifica claramente al titular/comprador (adquirente) y a la parte vendedora o transmitente.
- Si es una sentencia definitiva (ej. Información de Dominio), el titular es quien promovió y se declaró propietario.
- Extrae la superficie de terreno en m2 (solo número flotante).
- Resume las medidas y colindancias (norte, sur, oriente, poniente).
- Extrae número de escritura/instrumento, volumen, Notario y número de notaría.
- Si un campo no aparece en el texto, deja su valor en null. No inventes información."""

PROMPT_EXTRAER_USO_SUELO = """Eres un perito urbanístico municipal en México.
Extrae con precisión las características de la LICENCIA O CONSTANCIA DE USO DE SUELO del texto.

Instrucciones:
- Identifica el uso autorizado (ej. COMERCIAL, HABITACIONAL, CENTRO URBANO, MIXTO).
- Identifica el giro autorizado (ej. Minisúper, Comercio básico, etc.).
- Determina es_comercial: True si permite comercio o venta al por menor compatible con tienda/minisúper; False si es exclusivamente habitacional o prohíbe comercio.
- Extrae la vigencia explícita y fecha de expedición.
- Extrae la clave catastral, superficie y datos del titular.
- Si un campo no está presente, déjalo en null."""

PROMPT_EXTRAER_ALINEAMIENTO = """Eres un perito en desarrollo urbano y catastro municipal en México.
Extrae con precisión las características de la CONSTANCIA DE ALINEAMIENTO Y NÚMERO OFICIAL del texto.

Instrucciones:
- Identifica el número oficial asignado (ej. '174', '15', '104'; o 'S/N' si no se asigna).
- Identifica las medidas de alineamiento, frente y restricciones viales si constan.
- Extrae clave catastral, titular/propietario, vigencia y fecha de expedición.
- Si se menciona un documento antecedente de propiedad (ej. compraventa previa), extráelo.
- Si un dato no consta en el texto, déjalo en null."""

ESQUEMAS_POR_CLASE: dict[str, tuple[str, Type[BaseModel]]] = {
    "predial": (PROMPT_EXTRAER_PREDIAL, CamposPredial),
    "escritura": (PROMPT_EXTRAER_ESCRITURA, CamposEscritura),
    "uso de suelo": (PROMPT_EXTRAER_USO_SUELO, CamposUsoSuelo),
    "alineamiento y número oficial": (PROMPT_EXTRAER_ALINEAMIENTO, CamposAlineamiento),
}

# Palabras clave para calibración léxica de confianza
PALABRAS_CLAVE_POR_CLASE: dict[str, list[str]] = {
    "predial": [
        "predial",
        "catastral",
        "impuesto",
        "bimestre",
        "ejercicio",
        "tesoreria",
        "liquidaci",
        "recibo oficial",
        "folio fiscal",
    ],
    "escritura": [
        "notar",
        "escritura",
        "instrumento",
        "volumen",
        "comparec",
        "protocoliz",
        "compraventa",
        "registro publico",
        "adquisici",
        "sentencia definitiva",
    ],
    "uso de suelo": [
        "uso de suelo",
        "zonificaci",
        "licencia",
        "desarrollo urbano",
        "giro",
        "comercial",
        "habitacional",
        "densidad",
        "coeficiente",
    ],
    "alineamiento y número oficial": [
        "alineamiento",
        "numero oficial",
        "número oficial",
        "vialidad",
        "paramento",
        "restricci",
        "seccion vial",
        "croquis",
        "nomenclatura",
    ],
}


class ClasificadorAgent(BaseAgent):
    """Agente desarrollado con LangChain que clasifica documentos inmobiliarios,

    evalúa la confianza real y extrae las características vitales de cada tipo.
    """

    name = "clasificador"
    description = (
        "Clasifica y extrae características de documentos inmobiliarios "
        "(predial, escritura, uso de suelo, alineamiento y número oficial) mediante LangChain."
    )

    def __init__(self) -> None:
        self._llm = ChatOllama(
            model=settings.ollama_model,
            base_url=settings.ollama_base_url,
            temperature=0,
        )

        # Cadena 1 de LangChain: Clasificación, resumen y confianza LLM
        prompt_clasificacion = ChatPromptTemplate.from_messages(
            [
                ("system", PROMPT_SISTEMA_CLASIFICACION),
                ("human", "{texto}"),
            ]
        )
        self._chain_clasificar = prompt_clasificacion | self._llm.with_structured_output(
            ClasificacionDocumento
        )

    def _recortar_texto(self, texto: str, max_chars: int = 12000) -> str:
        """Evita desbordar la ventana de contexto manteniendo inicio y final del documento."""
        if len(texto) <= max_chars:
            return texto
        mitad = max_chars // 2
        return (
            texto[:mitad]
            + "\n\n[... TEXTO INTERMEDIO OMITIDO PARA ANÁLISIS NOTARIAL ...]\n\n"
            + texto[-mitad:]
        )

    def _calcular_confianza_calibrada(
        self,
        clase: TipoDocumento,
        confianza_llm: int,
        texto: str,
        campos_extraidos: dict[str, Any],
    ) -> tuple[int, dict[str, Any]]:
        """Calibra la confianza combinando la respuesta del LLM, presencia léxica

        y completitud de extracción para evitar el sesgo de sobreconfianza.
        """
        if clase == "ninguna":
            return confianza_llm, {"metodo": "directo_ninguna"}

        texto_lower = texto.lower()
        palabras_esperadas = PALABRAS_CLAVE_POR_CLASE.get(clase, [])
        coincidencias = [p for p in palabras_esperadas if p in texto_lower]
        score_lexico = (
            int((len(coincidencias) / max(len(palabras_esperadas), 1)) * 100)
            if palabras_esperadas
            else 50
        )

        # Completitud de campos
        total_campos = len(campos_extraidos)
        campos_llenos = sum(1 for v in campos_extraidos.values() if v is not None and v != "")
        score_completitud = int((campos_llenos / max(total_campos, 1)) * 100)

        # Ponderación calibrada: 45% LLM + 30% Léxico + 25% Completitud
        confianza_calibrada = int(
            (0.45 * confianza_llm) + (0.30 * score_lexico) + (0.25 * score_completitud)
        )
        confianza_calibrada = max(5, min(99, confianza_calibrada))

        detalle = {
            "confianza_llm": confianza_llm,
            "score_lexico": score_lexico,
            "palabras_clave_halladas": len(coincidencias),
            "score_completitud": score_completitud,
            "campos_detectados": f"{campos_llenos}/{total_campos}",
        }
        return confianza_calibrada, detalle

    async def run(self, input: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        texto_limpio = input.strip()
        if not texto_limpio:
            return ResultadoDocumento(
                clase="ninguna",
                confianza=0,
                confianza_llm=0,
                confianza_detalle={"error": "Texto de entrada vacío"},
                resumen="No se proporcionó texto para analizar.",
                evidencia="Texto vacío.",
                conflictos="Sin contenido.",
                nota="Entrada vacía.",
                campos={},
            ).model_dump()

        texto_procesar = self._recortar_texto(texto_limpio)

        # Paso 1 con LangChain: Clasificación y Resumen
        clasificacion: ClasificacionDocumento = await self._chain_clasificar.ainvoke(
            {"texto": texto_procesar}
        )

        clase = clasificacion.clase
        campos_extraidos: dict[str, Any] = {}

        # Paso 2 con LangChain: Extracción estructurada según la clase
        if clase in ESQUEMAS_POR_CLASE:
            prompt_extraer_texto, esquema_cls = ESQUEMAS_POR_CLASE[clase]
            prompt_extraccion = ChatPromptTemplate.from_messages(
                [
                    ("system", prompt_extraer_texto),
                    ("human", "{texto}"),
                ]
            )
            chain_extraccion = prompt_extraccion | self._llm.with_structured_output(esquema_cls)

            try:
                resultado_extraccion = await chain_extraccion.ainvoke({"texto": texto_procesar})
                if isinstance(resultado_extraccion, BaseModel):
                    campos_extraidos = resultado_extraccion.model_dump()
                elif isinstance(resultado_extraccion, dict):
                    campos_extraidos = resultado_extraccion
            except Exception as e:
                # Si falla la extracción estructurada por formato, no rompe el flujo
                campos_extraidos = {"error_extraccion": str(e)}

        # Calibración de confianza real
        confianza_real, detalle_conf = self._calcular_confianza_calibrada(
            clase=clase,
            confianza_llm=clasificacion.confianza_llm,
            texto=texto_procesar,
            campos_extraidos=campos_extraidos,
        )

        resultado = ResultadoDocumento(
            clase=clase,
            confianza=confianza_real,
            confianza_llm=clasificacion.confianza_llm,
            confianza_detalle=detalle_conf,
            resumen=clasificacion.resumen,
            evidencia=clasificacion.evidencia,
            conflictos=clasificacion.conflictos,
            nota=clasificacion.nota,
            campos=campos_extraidos,
        )

        return resultado.model_dump()
