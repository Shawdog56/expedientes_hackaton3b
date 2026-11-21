"""Pruebas exhaustivas y detalladas para la FASE 4:

Motor de Veredicto, Explicativa Ejecutiva y las 5 Métricas de Confianza.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.services.validador_cruzado import validar_expediente_cruzado
from app.services.validador_documento import validar_documento_individual


def crear_doc_base(clase: str, confianza: int, campos: dict) -> dict:
    """Helper para generar documentos validados sintéticos."""
    doc = {
        "clase": clase,
        "confianza": confianza,
        "confianza_llm": confianza,
        "campos": campos,
    }
    return validar_documento_individual(doc, anio_referencia=2025)


def expediente_armonico():
    """Expediente 100% armónico con las 4 clases."""
    return [
        crear_doc_base(
            "predial",
            94,
            {
                "propietario_o_contribuyente": "SANDOVAL ROMERO MA. ISABEL",
                "clave_catastral": "0040111241000000",
                "superficie_terreno_m2": 537.0,
                "ejercicio_o_periodo": "2025",
                "total_pagado": 16406.46,
                "es_comprobante_pago": True,
            },
        ),
        crear_doc_base(
            "escritura",
            92,
            {
                "titular_o_comprador": "SANDOVAL ROMERO MA. ISABEL",
                "direccion_inmueble": "AV. CRISPIN PEREZ",
                "clave_catastral": "0040111241000000",
                "superficie_terreno_m2": 537.0,
                "numero_escritura_o_instrumento": "12,450",
            },
        ),
        crear_doc_base(
            "uso de suelo",
            90,
            {
                "titular_o_solicitante": "SANDOVAL ROMERO MA. ISABEL",
                "direccion_inmueble": "AV. CRISPIN PEREZ",
                "clave_catastral": "0040111241000000",
                "superficie_terreno_m2": 537.0,
                "uso_autorizado": "COMERCIAL",
                "giro_permitido": "MINI SUPER",
                "es_comercial": True,
            },
        ),
        crear_doc_base(
            "alineamiento y número oficial",
            93,
            {
                "titular_o_propietario": "SANDOVAL ROMERO MA. ISABEL",
                "direccion_oficial": "AV. CRISPIN PEREZ NO. 174",
                "numero_oficial_asignado": "174",
                "clave_catastral": "0040111241000000",
                "superficie_terreno_m2": 537.0,
            },
        ),
    ]


def test_cinco_confianzas_cumple():
    print("--- Test 4.1: Estructura y coherencia de las 5 Confianzas (Cumple) ---")
    docs = expediente_armonico()
    res = validar_expediente_cruzado(docs, anio_referencia=2025)

    assert res["veredicto"] == "Cumple"
    cinco = res["cinco_confianzas"]

    # Validar que existan las 5 métricas requeridas
    assert "confianza_predial" in cinco
    assert "confianza_escritura" in cinco
    assert "confianza_uso_de_suelo" in cinco
    assert "confianza_alineamiento_y_numero_oficial" in cinco
    assert "confianza_veredicto_final" in cinco

    # Validar tipos y rangos
    for clave, valor in cinco.items():
        assert isinstance(valor, int), f"{clave} debe ser int"
        assert 0 <= valor <= 100, f"{clave} fuera de rango: {valor}"

    # En caso 'Cumple', la confianza final debe ser alta (aprobación sólida)
    assert cinco["confianza_veredicto_final"] >= 85
    print("✅ Las 5 métricas de confianza calculadas correctamente:")
    for k, v in cinco.items():
        print(f"   • {k}: {v}%")


def test_degradacion_por_baja_confianza_escaneo():
    print("\n--- Test 4.2: Degradación a 'Requiere Revisión' por baja confianza de OCR ---")
    docs = expediente_armonico()
    # Simulamos que el alineamiento tuvo un escaneo deficiente (confianza 58% < 70%)
    docs[3]["confianza"] = 58

    res = validar_expediente_cruzado(docs, anio_referencia=2025)
    assert res["veredicto"] == "Requiere Revisión"
    assert any(h["regla"] == "confianza_clasificacion_baja" for h in res["hallazgos_advertencias"])
    # La confianza global debe reflejar incertidumbre humana
    assert res["cinco_confianzas"]["confianza_veredicto_final"] < 85
    print("✅ Baja calidad de escaneo degrada veredicto a 'Requiere Revisión' preventivo.")


def test_umbrales_exactos_tolerancia_superficie():
    print("\n--- Test 4.3: Umbrales límite de variación de superficie (2% y 5%) ---")

    # Caso A: Variación exacta del 2.0% -> CUMPLE
    # 500 m² vs 510 m² -> dif = 10 / 500 = 0.02 (2.0%)
    docs_a = expediente_armonico()
    docs_a[0]["campos_normalizados"]["superficie_terreno_m2"] = 500.0
    docs_a[1]["campos_normalizados"]["superficie_terreno_m2"] = 510.0
    docs_a[2]["campos_normalizados"]["superficie_terreno_m2"] = 500.0
    docs_a[3]["campos_normalizados"]["superficie_terreno_m2"] = 500.0
    res_a = validar_expediente_cruzado(docs_a, anio_referencia=2025)
    assert res_a["veredicto"] == "Cumple"
    print("   • Variación 2.0% -> Cumple (dentro de tolerancia)")

    # Caso B: Variación del 3.5% (entre 2% y 5%) -> REQUIERE REVISIÓN
    # 500 m² vs 517.5 m² -> dif = 3.5%
    docs_b = expediente_armonico()
    docs_b[0]["campos_normalizados"]["superficie_terreno_m2"] = 500.0
    docs_b[1]["campos_normalizados"]["superficie_terreno_m2"] = 517.5
    docs_b[2]["campos_normalizados"]["superficie_terreno_m2"] = 500.0
    docs_b[3]["campos_normalizados"]["superficie_terreno_m2"] = 500.0
    res_b = validar_expediente_cruzado(docs_b, anio_referencia=2025)
    assert res_b["veredicto"] == "Requiere Revisión"
    assert any(h["regla"] == "superficie_discrepancia_menor" for h in res_b["hallazgos_advertencias"])
    print("   • Variación 3.5% -> Requiere Revisión (advertencia de deslinde)")

    # Caso C: Variación del 8.0% (> 5%) -> NO CUMPLE
    # 500 m² vs 540 m² -> dif = 8.0%
    docs_c = expediente_armonico()
    docs_c[0]["campos_normalizados"]["superficie_terreno_m2"] = 500.0
    docs_c[1]["campos_normalizados"]["superficie_terreno_m2"] = 540.0
    docs_c[2]["campos_normalizados"]["superficie_terreno_m2"] = 500.0
    docs_c[3]["campos_normalizados"]["superficie_terreno_m2"] = 500.0
    res_c = validar_expediente_cruzado(docs_c, anio_referencia=2025)
    assert res_c["veredicto"] == "No Cumple"
    assert any(h["regla"] == "superficie_discrepancia_grave" for h in res_c["hallazgos_criticos"])
    print("   • Variación 8.0% -> No Cumple (inconsistencia grave)")


def test_multiples_fallas_acumulativas():
    print("\n--- Test 4.4: Auditoría exhaustiva: Múltiples fallas acumuladas ---")
    docs = expediente_armonico()

    # 1. Predial vencido y no acreditado
    docs[0]["campos_normalizados"]["es_comprobante_pago"] = False
    docs[0]["campos_normalizados"]["ejercicio_anio"] = 2023

    # 2. Uso de suelo habitacional incompatible
    docs[2]["campos_normalizados"]["es_comercial"] = False
    docs[2]["campos_normalizados"]["uso_autorizado"] = "HABITACIONAL DENSIDAD BAJA"

    # 3. Clave catastral distinta en escritura
    docs[1]["campos_normalizados"]["clave_catastral"] = "9999999999999999"

    res = validar_expediente_cruzado(docs, anio_referencia=2025)

    assert res["veredicto"] == "No Cumple"
    reglas_criticas = [h["regla"] for h in res["hallazgos_criticos"]]

    # Validar que NO hubo salida temprana y se reportaron TODAS las fallas
    assert "predial_no_acreditado" in reglas_criticas
    assert "predial_vencido" in reglas_criticas
    assert "uso_suelo_incompatible" in reglas_criticas
    assert "discrepancia_clave_catastral" in reglas_criticas

    print(f"✅ Se detectaron y compilaron las {len(reglas_criticas)} anomalías críticas sin interrupción:")
    for r in reglas_criticas:
        print(f"   • {r}")


def test_narrativa_markdown_ejecutiva():
    print("\n--- Test 4.5: Calidad de la narrativa y explicativa ejecutiva ---")
    docs = expediente_armonico()
    res = validar_expediente_cruzado(docs, anio_referencia=2025)

    texto = res["explicacion"]
    assert "DICTAMEN DE AUDITORÍA: CUMPLE" in texto
    assert "5 Niveles de Confianza del Expediente:" in texto
    assert "Boleta Predial:" in texto
    assert "Confianza Global del Dictamen:" in texto
    print("✅ Formato Markdown y redacción ejecutiva verificados correctamente.")


if __name__ == "__main__":
    test_cinco_confianzas_cumple()
    test_degradacion_por_baja_confianza_escaneo()
    test_umbrales_exactos_tolerancia_superficie()
    test_multiples_fallas_acumulativas()
    test_narrativa_markdown_ejecutiva()
    print("\n🎉 ¡TODAS LAS PRUEBAS DE LA FASE 4 PASARON EXITOSAMENTE!")
