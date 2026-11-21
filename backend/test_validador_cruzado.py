"""Pruebas exhaustivas para el Validador Cruzado y Motor de Veredicto."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.services.validador_cruzado import validar_expediente_cruzado
from app.services.validador_documento import validar_documento_individual


def fixture_expediente_melchor_ocampo_completo():
    """Expediente real consistente de Melchor Ocampo."""
    predial = {
        "clase": "predial",
        "confianza": 94,
        "campos": {
            "propietario_o_contribuyente": "SANDOVAL ROMERO MA. ISABEL",
            "direccion": "CRISPIN PEREZ S/N MELCHOR OCAMPO",
            "clave_catastral": "0040111241000000",
            "superficie_terreno_m2": 537.0,
            "ejercicio_o_periodo": "2025",
            "total_pagado": 16406.46,
            "es_comprobante_pago": True,
        },
    }
    escritura = {
        "clase": "escritura",
        "confianza": 91,
        "campos": {
            "titular_o_comprador": "SANDOVAL ROMERO MA. ISABEL",
            "direccion_inmueble": "AV. CRISPIN PEREZ MELCHOR OCAMPO",
            "clave_catastral": "0040111241000000",
            "superficie_terreno_m2": 536.82,  # 0.03% variación
            "numero_escritura_o_instrumento": "12,450",
            "notario_y_notaria": "Notaria 5 Cuautitlan",
        },
    }
    uso_suelo = {
        "clase": "uso de suelo",
        "confianza": 89,
        "campos": {
            "titular_o_solicitante": "SANDOVAL ROMERO MA. ISABEL",
            "direccion_inmueble": "AV. CRISPIN PEREZ",
            "clave_catastral": "0040111241000000",
            "superficie_terreno_m2": 536.82,
            "uso_autorizado": "COMERCIAL",
            "giro_permitido": "MINI SUPER",
            "es_comercial": True,
        },
    }
    alineamiento = {
        "clase": "alineamiento y número oficial",
        "confianza": 92,
        "campos": {
            "titular_o_propietario": "SANDOVAL ROMERO MA. ISABEL GICELA",
            "direccion_oficial": "AV. CRISPIN PEREZ NO. 174",
            "numero_oficial_asignado": "174",
            "clave_catastral": "0040111241000000",
            "superficie_terreno_m2": 536.82,
        },
    }
    docs = [predial, escritura, uso_suelo, alineamiento]
    return [validar_documento_individual(d, anio_referencia=2025) for d in docs]


def test_caso_completo_cumple():
    print("--- 1. Probando Caso Completo (Cumple) ---")
    docs = fixture_expediente_melchor_ocampo_completo()
    res = validar_expediente_cruzado(docs, anio_referencia=2025)

    assert res["veredicto"] == "Cumple"
    assert res["confianza_veredicto"] >= 85
    assert len(res["hallazgos_criticos"]) == 0
    assert len(res["confianzas_por_documento"]) == 4
    print("✅ Veredicto 'Cumple' validado con éxito:")
    print(f"   Confianza final: {res['confianza_veredicto']}%")
    print(f"   Confianzas docs: {res['confianzas_por_documento']}")


def test_caso_documento_faltante():
    print("\n--- 2. Probando Documento Faltante ---")
    docs = fixture_expediente_melchor_ocampo_completo()
    # Retiramos la escritura (solo 3 docs)
    docs_faltantes = [d for d in docs if d["clase"] != "escritura"]
    res = validar_expediente_cruzado(docs_faltantes, anio_referencia=2025)

    assert res["veredicto"] == "No Cumple"
    assert any(h["regla"] == "documentos_faltantes" for h in res["hallazgos_criticos"])
    assert "escritura" in res["resumen_coleccion"]["tipos_faltantes"]
    print("✅ Documento faltante detectado correctamente (No Cumple).")


def test_caso_predial_no_acreditado():
    print("\n--- 3. Probando Predial No Acreditado (Formato de ventanilla) ---")
    docs = fixture_expediente_melchor_ocampo_completo()
    for d in docs:
        if d["clase"] == "predial":
            d["campos_normalizados"]["es_comprobante_pago"] = False

    res = validar_expediente_cruzado(docs, anio_referencia=2025)
    assert res["veredicto"] == "No Cumple"
    assert any(h["regla"] == "predial_no_acreditado" for h in res["hallazgos_criticos"])
    print("✅ Formato sin certificación de pago detectado (No Cumple).")


def test_caso_uso_suelo_habitacional():
    print("\n--- 4. Probando Uso de Suelo Habitacional (Incompatible) ---")
    docs = fixture_expediente_melchor_ocampo_completo()
    for d in docs:
        if d["clase"] == "uso de suelo":
            d["campos_normalizados"]["es_comercial"] = False
            d["campos_normalizados"]["uso_autorizado"] = "HABITACIONAL UNIFAMILIAR"

    res = validar_expediente_cruzado(docs, anio_referencia=2025)
    assert res["veredicto"] == "No Cumple"
    assert any(h["regla"] == "uso_suelo_incompatible" for h in res["hallazgos_criticos"])
    print("✅ Uso de suelo no comercial detectado (No Cumple).")


def test_caso_claves_distintas():
    print("\n--- 5. Probando Claves Catastrales Inconsistentes ---")
    docs = fixture_expediente_melchor_ocampo_completo()
    for d in docs:
        if d["clase"] == "escritura":
            d["campos_normalizados"]["clave_catastral"] = "1120314518000000"

    res = validar_expediente_cruzado(docs, anio_referencia=2025)
    assert res["veredicto"] == "No Cumple"
    assert any(h["regla"] == "discrepancia_clave_catastral" for h in res["hallazgos_criticos"])
    print("✅ Discrepancia de clave catastral detectada (No Cumple).")


def test_caso_requiere_revision():
    print("\n--- 6. Probando Caso 'Requiere Revisión' (Variación moderada) ---")
    docs = fixture_expediente_melchor_ocampo_completo()
    for d in docs:
        if d["clase"] == "escritura":
            # 3.5% de variación en superficie (entre 2% y 5%)
            d["campos_normalizados"]["superficie_terreno_m2"] = 556.0

    res = validar_expediente_cruzado(docs, anio_referencia=2025)
    assert res["veredicto"] == "Requiere Revisión"
    assert any(h["regla"] == "superficie_discrepancia_menor" for h in res["hallazgos_advertencias"])
    print("✅ Variación de superficie calibrada a 'Requiere Revisión'.")


if __name__ == "__main__":
    test_caso_completo_cumple()
    test_caso_documento_faltante()
    test_caso_predial_no_acreditado()
    test_caso_uso_suelo_habitacional()
    test_caso_claves_distintas()
    test_caso_requiere_revision()
    print("\n🎉 ¡TODAS LAS PRUEBAS DE VALIDACIÓN CRUZADA Y VEREDICTO PASARON!")
