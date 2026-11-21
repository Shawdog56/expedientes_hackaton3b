"""Pruebas unitarias para normalización y validador de documentos individuales."""
from difflib import SequenceMatcher
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.services.normalizacion import (
    extraer_anio,
    normalizar_clave_catastral,
    normalizar_nombre_persona,
    normalizar_superficie,
)
from app.services.validador_documento import validar_documento_individual


def test_normalizacion():
    print("--- Probando normalización ---")
    # Claves catastrales
    assert normalizar_clave_catastral("007-01-511-26-00-00000") == "00701511260000000"
    assert normalizar_clave_catastral("112 03 145 18 00 0000") == "1120314518000000"
    assert normalizar_clave_catastral("0040111241000000") == "0040111241000000"
    print("✅ Claves catastrales OK")

    # Nombres
    assert (
        normalizar_nombre_persona("DRA. VICTORIA AURELIA VÍQUEZ VEGA")
        == "VICTORIA AURELIA VIQUEZ VEGA"
    )
    # Comparación aproximada de nombres con ruido de OCR
    nom1 = normalizar_nombre_persona("SANDOVAL ROMERO MA. ISABEL")
    nom2 = normalizar_nombre_persona("SANDOVAL ROMEROMA.ISABEL GICELA")
    similitud = SequenceMatcher(None, nom1, nom2).ratio()
    assert similitud > 0.80  # Pasa umbral de similitud
    print(f"✅ Nombres OK (similitud con ruido OCR: {similitud:.2f})")

    # Superficies
    assert normalizar_superficie("536.82 M²") == 536.82
    assert normalizar_superficie("1,262.50") == 1262.50
    assert normalizar_superficie(537) == 537.0
    print("✅ Superficies OK")

    # Años
    assert extraer_anio("016/10/2025") == 2025
    assert extraer_anio("25/01/2024") == 2024
    assert extraer_anio("2025") == 2025
    print("✅ Años OK")


def test_validador_predial():
    print("\n--- Probando Validador de Predial ---")
    # Caso 1: Predial pagado y vigente (2025/2026)
    doc_valido = {
        "clase": "predial",
        "confianza": 92,
        "confianza_llm": 95,
        "campos": {
            "propietario_o_contribuyente": "SANDOVAL ROMERO MA. ISABEL",
            "clave_catastral": "0040111241000000",
            "ejercicio_o_periodo": "2025",
            "total_pagado": 16406.46,
            "superficie_terreno_m2": 537.0,
            "es_comprobante_pago": True,
        },
    }
    res_valido = validar_documento_individual(doc_valido, anio_referencia=2025)
    assert res_valido["estado_documento"] == "valido"
    assert len(res_valido["campos_faltantes_criticos"]) == 0
    print("✅ Predial válido OK")

    # Caso 2: Formato de captura que NO es comprobante de pago
    doc_invalido = {
        "clase": "predial",
        "confianza": 85,
        "confianza_llm": 88,
        "campos": {
            "propietario_o_contribuyente": None,
            "clave_catastral": "0370603322000000",
            "ejercicio_o_periodo": "2025",
            "total_pagado": 390.0,
            "es_comprobante_pago": False,  # Línea de captura
        },
    }
    res_invalido = validar_documento_individual(doc_invalido, anio_referencia=2025)
    assert res_invalido["estado_documento"] == "invalido"
    assert any("NO ACREDITA PAGO" in obs for obs in res_invalido["observaciones"])
    print("✅ Predial no acreditado detectado OK")


def test_validador_uso_suelo():
    print("\n--- Probando Validador de Uso de Suelo ---")
    # Caso 1: Comercial
    doc_comercial = {
        "clase": "uso de suelo",
        "confianza": 90,
        "confianza_llm": 92,
        "campos": {
            "titular_o_solicitante": "GARCIA CERVANTES ALEJANDRO FELIX",
            "direccion_inmueble": "AV. SOR JUANA INES DE LA CRUZ NO. 15",
            "uso_autorizado": "COMERCIAL",
            "giro_permitido": "MINI SUPER",
            "es_comercial": True,
        },
    }
    res_comercial = validar_documento_individual(doc_comercial)
    assert res_comercial["estado_documento"] == "valido"
    print("✅ Uso de suelo comercial OK")

    # Caso 2: Habitacional (incompatible con Tiendas 3B)
    doc_habitacional = {
        "clase": "uso de suelo",
        "confianza": 90,
        "confianza_llm": 92,
        "campos": {
            "titular_o_solicitante": "ROSA MARIA QUINTANAR LEDESMA",
            "direccion_inmueble": "CALLE FRESNO NO. 28",
            "uso_autorizado": "HABITACIONAL",
            "giro_permitido": "VIVIENDA UNIFAMILIAR",
            "es_comercial": False,
        },
    }
    res_hab = validar_documento_individual(doc_habitacional)
    assert res_hab["estado_documento"] == "invalido"
    assert any("INCOMPATIBLE" in obs for obs in res_hab["observaciones"])
    print("✅ Uso de suelo habitacional detectado como INCOMPATIBLE OK")


if __name__ == "__main__":
    test_normalizacion()
    test_validador_predial()
    test_validador_uso_suelo()
    print("\n🎉 ¡TODAS LAS PRUEBAS DE LA FASE 2 PASARON EXITOSAMENTE!")
