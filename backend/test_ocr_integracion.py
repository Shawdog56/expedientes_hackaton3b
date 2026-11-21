"""Pruebas de integración del Agente OCR y su transporte al ClasificadorAgent."""

from pathlib import Path
from unittest.mock import MagicMock

from app.agents.ocr import OCRAgent
from app.services.expediente_service import ExpedienteService


def _run_coro(coro):
    """Ejecutor síncrono para pruebas sin depender de bucles de eventos bloqueados."""
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value


def test_ocr_extrae_texto_digital():
    ocr = OCRAgent()
    ruta_pdf = Path(
        "backend/app/agents/prueba3b/documentos/Alineamiento_y_Numero_Oficial/ALINEAMIENTO Y NUMERO OFICIAL-TULTEPEC INSURGENTES.pdf"
    )
    if not ruta_pdf.exists():
        ruta_pdf = Path(
            "expedientes_hackaton3b/backend/app/agents/prueba3b/documentos/Alineamiento_y_Numero_Oficial/ALINEAMIENTO Y NUMERO OFICIAL-TULTEPEC INSURGENTES.pdf"
        )

    res = ocr.extraer_texto(ruta_pdf)
    assert res["metodo"] == "digital_pdf"
    assert res["paginas"] == 1
    assert "TULTEPEC" in res["texto"]
    assert "ALINEAMIENTO" in res["texto"]


def test_ocr_extrae_texto_plano():
    ocr = OCRAgent()
    ruta_txt = Path("tests/samples/alineamiento_ejemplo.txt")
    if not ruta_txt.exists():
        ruta_txt = Path("expedientes_hackaton3b/tests/samples/alineamiento_ejemplo.txt")

    res = ocr.extraer_texto(ruta_txt)
    assert res["metodo"] == "texto_plano"
    assert len(res["texto"]) > 100


def test_ocr_transporta_a_clasificador():
    # Mock del ClasificadorAgent para probar el transporte y orquestación
    mock_clasificador = MagicMock()

    async def mock_run(texto, context=None):
        return {
            "clase": "alineamiento y número oficial",
            "confianza": 92,
            "confianza_llm": 95,
            "resumen": "Constancia de alineamiento oficial",
            "evidencia": "Documento emitido por Tultepec",
            "conflictos": "",
            "nota": "",
            "campos": {
                "numero_oficial": "174",
                "clave_catastral": "0040111241000000",
                "titular": "SANDOVAL ROMERO MA. ISABEL",
            },
        }

    mock_clasificador.run = mock_run

    ocr = OCRAgent()
    servicio = ExpedienteService(clasificador=mock_clasificador, ocr_agent=ocr)

    ruta_pdf = Path(
        "backend/app/agents/prueba3b/documentos/Alineamiento_y_Numero_Oficial/ALINEAMIENTO Y NUMERO OFICIAL-TULTEPEC INSURGENTES.pdf"
    )
    if not ruta_pdf.exists():
        ruta_pdf = Path(
            "expedientes_hackaton3b/backend/app/agents/prueba3b/documentos/Alineamiento_y_Numero_Oficial/ALINEAMIENTO Y NUMERO OFICIAL-TULTEPEC INSURGENTES.pdf"
        )

    doc_resultado = _run_coro(
        servicio.extraer_y_clasificar_documento(ruta_pdf, nombre="alineamiento.pdf")
    )

    # Verificar que el OCR recuperó el texto y lo entregó al ClasificadorAgent
    assert doc_resultado["clase"] == "alineamiento y número oficial"
    assert doc_resultado["archivo"] == "alineamiento.pdf"
    assert doc_resultado["ocr_metadatos"]["metodo"] == "digital_pdf"
    assert doc_resultado["ocr_metadatos"]["paginas"] == 1


def test_auditar_archivos_flujo_completo():
    mock_clasificador = MagicMock()

    async def mock_run(texto, context=None):
        if "predial" in texto.lower():
            return {
                "clase": "predial",
                "confianza": 90,
                "resumen": "Boleta predial 2025",
                "campos": {
                    "clave_catastral": "004-01-112-41",
                    "superficie_terreno_m2": 500.0,
                    "propietario": "SANDOVAL ROMERO MA. ISABEL",
                    "anio_fiscal": 2025,
                    "es_recibo_pagado": True,
                },
            }
        return {
            "clase": "escritura",
            "confianza": 95,
            "resumen": "Escritura pública notarial",
            "campos": {
                "clave_catastral": "0040111241000000",
                "superficie_terreno_m2": 500.0,
                "titular": "SANDOVAL ROMERO MA. ISABEL",
            },
        }

    mock_clasificador.run = mock_run

    servicio = ExpedienteService(clasificador=mock_clasificador, ocr_agent=OCRAgent())

    archivos = [
        ("boleta_predial.txt", b"Comprobante de pago de impuesto predial 2025. Clave 004-01-112-41"),
        ("escritura.txt", b"Escritura publica numero 1234. Notario 5. Titular SANDOVAL ROMERO."),
    ]

    # Para simular gather síncronamente en prueba
    docs_clasificados = [
        _run_coro(servicio.extraer_y_clasificar_documento(contenido, nombre=nombre))
        for nombre, contenido in archivos
    ]
    assert len(docs_clasificados) == 2
    assert docs_clasificados[0]["clase"] == "predial"
    assert docs_clasificados[0]["ocr_metadatos"]["metodo"] == "texto_plano"
    assert docs_clasificados[1]["clase"] == "escritura"


if __name__ == "__main__":
    test_ocr_extrae_texto_digital()
    print("test_ocr_extrae_texto_digital PASÓ")
    test_ocr_extrae_texto_plano()
    print("test_ocr_extrae_texto_plano PASÓ")
    test_ocr_transporta_a_clasificador()
    print("test_ocr_transporta_a_clasificador PASÓ")
    test_auditar_archivos_flujo_completo()
    print("test_auditar_archivos_flujo_completo PASÓ")
    print("\nTODAS LAS PRUEBAS DE INTEGRACIÓN OCR -> CLASIFICADOR PASARON EXITOSAMENTE.")
