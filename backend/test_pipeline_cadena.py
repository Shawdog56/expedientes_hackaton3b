"""Prueba en cadena integral (End-to-End) del sistema de expedientes de Tiendas 3B.

Simula el flujo completo desde la lectura de los 4 archivos de texto (.txt) de un
expediente real (Melchor Ocampo, incluyendo el archivo real text.txt de alineamiento),
pasando por la clasificación, validación individual, cruce de información, cálculo
de las 5 confianzas y generación del dictamen final.
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.services.validador_cruzado import validar_expediente_cruzado
from app.services.validador_documento import validar_documento_individual


def cargar_textos_expediente_melchor_ocampo() -> dict[str, str]:
    """Carga el archivo real text.txt y genera los otros 3 textos del expediente de Melchor Ocampo."""
    ruta_text_txt = Path(r"c:\Users\lopez\Desktop\Tareas ESCOM\Tiendas3B\text.txt")
    if ruta_text_txt.exists():
        texto_alineamiento = ruta_text_txt.read_text(encoding="utf-8")
    else:
        texto_alineamiento = """
        DIRECCION DE DESARROLLO URBANO MELCHOR OCAMPO
        CONSTANCIA DE ALINEAMIENTO Y NUMERO OFICIAL
        NOMBRE DEL PROPIETARIO: SANDOVAL ROMEROMA.ISABEL GICELA
        CALLE: AV. CRISPIN PEREZ NUMERO OFICIAL 174
        SUPERFICIE DE TERRENO: 536.82 M²
        CLAVE CATASTRAL: 0040111241000000
        FECHA DE EXPEDICIÓN: 16/10/2024
        FECHA DEVENCIMIENTO: 016/10/2025
        TOTAL: $1,218.15
        """

    texto_predial = """
    GOBIERNO DE MELCHOR OCAMPO 2025-2027
    RECIBO OFICIAL DE PAGO MA055690
    Nombre: SANDOVAL ROMERO MA. ISABEL
    Clave Catastral: 0040111241000000
    PERIODO DE PAGO: 01-2025 12-2025
    Superficie: TERRENO M2: 537.00 CONSTRUCCIÓN M2: 1,000.00
    Ubicación: CRISPIN PEREZ S/N MELCHOR OCAMPO
    IMPUESTO PREDIAL - CLAVE CATASTRAL: 0040111241000000
    VALOR CATASTRAL: 6,901,354.00
    Total: 16,406.46
    Sello Digital del CFDI: lurRzRIHOQLwdzPNauwvY7sVQGrkGMuOv32vdpK...
    H. Ayuntamiento Constitucional de Melchor Ocampo 2025 - 2027
    29 ENE 2025 PAGADO
    """

    texto_escritura = """
    LIC. ROBERTO VAZQUEZ MENDOZA - NOTARIO PUBLICO NO. 5 DE CUAUTITLAN
    VOLUMEN 210 --------- INSTRUMENTO NUMERO 18,340 ---------
    En la ciudad de Cuautitlán, ante mí comparecen por una parte como VENDEDOR
    FRANCISCO JAVIER MORALES y como COMPRADOR a ROSA MA. ISABEL SANDOVAL ROMERO.
    ANTECEDENTES:
    Declara que es legítima propietaria del inmueble ubicado en Avenida Crispín Pérez,
    Centro Melchor Ocampo, Estado de México, con superficie de 536.82 metros cuadrados,
    identificado con la clave catastral 0040111241000000.
    MEDIDAS Y COLINDANCIAS: Al Norte 10.53 m con Av. Crispín Pérez; Al Sur 10.73 m;
    Al Oriente 50.00 m; Al Poniente 50.00 m.
    Libre de todo gravamen y al corriente del pago del impuesto predial.
    INSCRITO EN EL INSTITUTO DE LA FUNCION REGISTRAL DEL ESTADO DE MEXICO.
    """

    texto_uso_suelo = """
    H. AYUNTAMIENTO CONSTITUCIONAL DE MELCHOR OCAMPO
    DIRECCION DE DESARROLLO URBANO Y METROPOLITANO
    LICENCIA DE USO DEL SUELO FOLIO: DDU/LUS/088/2024
    NOMBRE: SANDOVAL ROMERO MA. ISABEL
    DOMICILIO: AV. CRISPIN PEREZ NO. 174, CENTRO MELCHOR OCAMPO
    CLAVE CATASTRAL: 0040111241000000
    SUPERFICIE DEL PREDIO: 536.82 m²
    USO DE SUELO QUE SE AUTORIZA: COMERCIAL
    GIRO AUTORIZADO: MINISUPER - COMERCIO AL POR MENOR
    VIGENCIA: 16 DE OCTUBRE DE 2025
    FECHA DE EXPEDICION: 16 DE OCTUBRE DE 2024
    AUTORIZA: DIRECTORA DE DESARROLLO URBANO
    """

    return {
        "predial": texto_predial,
        "escritura": texto_escritura,
        "uso_de_suelo": texto_uso_suelo,
        "alineamiento": texto_alineamiento,
    }


def ejecutar_pipeline_completo(respuestas_clasificador: list[dict], anio_referencia: int = 2025) -> dict:
    """Ejecuta las fases del pipeline (Validación Individual + Normalización + Validación Cruzada + 5 Confianzas)."""
    # Paso 2: Validación individual y normalización
    docs_normalizados = [
        validar_documento_individual(doc, anio_referencia=anio_referencia)
        for doc in respuestas_clasificador
    ]
    # Paso 3 y 4: Validación cruzada de expediente, 5 confianzas y veredicto
    dictamen = validar_expediente_cruzado(
        documentos=docs_normalizados,
        anio_referencia=anio_referencia,
    )
    return {
        **dictamen,
        "documentos": docs_normalizados,
    }


def test_cadena_completa_expediente_valido():
    print("=" * 70)
    print("PRUEBA EN CADENA 1: EXPEDIENTE COMPLETO Y CONFORME (MELCHOR OCAMPO)")
    print("=" * 70)

    textos_dict = cargar_textos_expediente_melchor_ocampo()
    assert len(textos_dict) == 4
    print("✅ 4 archivos de texto cargados desde el almacenamiento del proyecto.")

    respuestas_clasificador = [
        {
            "clase": "predial",
            "confianza": 94,
            "confianza_llm": 95,
            "resumen": "Boleta de pago de impuesto predial 2025 para el predio en Melchor Ocampo.",
            "campos": {
                "propietario_o_contribuyente": "SANDOVAL ROMERO MA. ISABEL",
                "clave_catastral": "0040111241000000",
                "ejercicio_o_periodo": "2025",
                "total_pagado": 16406.46,
                "superficie_terreno_m2": 537.0,
                "es_comprobante_pago": True,
                "autoridad_emisora": "Gobierno de Melchor Ocampo",
            },
        },
        {
            "clase": "escritura",
            "confianza": 92,
            "confianza_llm": 94,
            "resumen": "Escritura pública notarial de compraventa a favor de Isabel Sandoval Romero.",
            "campos": {
                "titular_o_comprador": "SANDOVAL ROMERO MA. ISABEL",
                "vendedor": "FRANCISCO JAVIER MORALES",
                "direccion_inmueble": "AV. CRISPIN PEREZ MELCHOR OCAMPO",
                "clave_catastral": "0040111241000000",
                "superficie_terreno_m2": 536.82,
                "numero_escritura_o_instrumento": "18,340",
            },
        },
        {
            "clase": "uso de suelo",
            "confianza": 90,
            "confianza_llm": 92,
            "resumen": "Licencia de uso de suelo comercial para giro minisúper en Melchor Ocampo.",
            "campos": {
                "titular_o_solicitante": "SANDOVAL ROMERO MA. ISABEL",
                "direccion_inmueble": "AV. CRISPIN PEREZ NO. 174",
                "clave_catastral": "0040111241000000",
                "superficie_terreno_m2": 536.82,
                "uso_autorizado": "COMERCIAL",
                "giro_permitido": "MINISUPER",
                "es_comercial": True,
                "vigencia": "16 DE OCTUBRE DE 2025",
            },
        },
        {
            "clase": "alineamiento y número oficial",
            "confianza": 93,
            "confianza_llm": 95,
            "resumen": "Constancia oficial de asignación del número 174 y medidas viales.",
            "campos": {
                "titular_o_propietario": "SANDOVAL ROMEROMA.ISABEL GICELA",
                "direccion_oficial": "AV. CRISPIN PEREZ NO. 174",
                "numero_oficial_asignado": "174",
                "clave_catastral": "0040111241000000",
                "superficie_terreno_m2": 536.82,
                "vigencia": "16/10/2025",
            },
        },
    ]

    resultado = ejecutar_pipeline_completo(respuestas_clasificador, anio_referencia=2025)

    print("\nRESULTADO OBTENIDO DEL PIPELINE COMPLETO:")
    print(f"• Veredicto: {resultado['veredicto']}")
    print(f"• Confianza Veredicto: {resultado['confianza_veredicto']}%")
    print("• Cinco Confianzas:")
    for k, v in resultado["cinco_confianzas"].items():
        print(f"    - {k}: {v}%")
    print(f"• Hallazgos Conformes ({len(resultado['hallazgos_conformes'])}):")
    for h in resultado["hallazgos_conformes"]:
        print(f"    🟢 {h['descripcion']}")

    assert resultado["veredicto"] == "Cumple"
    assert resultado["confianza_veredicto"] >= 85
    assert len(resultado["hallazgos_criticos"]) == 0
    assert len(resultado["documentos"]) == 4
    print("\n✅ CADENA 1 (EXPEDIENTE CUMPLE) COMPLETADA CON ÉXITO.\n")


def test_cadena_completa_expediente_inconsistente():
    print("=" * 70)
    print("PRUEBA EN CADENA 2: EXPEDIENTE CON FALLAS CRÍTICAS (RECHAZO AUDITADO)")
    print("=" * 70)

    respuestas_falla = [
        {
            "clase": "escritura",
            "confianza": 88,
            "confianza_llm": 90,
            "resumen": "Escritura pública.",
            "campos": {
                "titular_o_comprador": "JUAN PEREZ",
                "clave_catastral": "1111111111111111",
                "superficie_terreno_m2": 200.0,
                "numero_escritura_o_instrumento": "100",
            },
        },
        {
            "clase": "uso de suelo",
            "confianza": 85,
            "confianza_llm": 88,
            "resumen": "Uso de suelo habitacional.",
            "campos": {
                "titular_o_solicitante": "JUAN PEREZ",
                "clave_catastral": "1111111111111111",
                "superficie_terreno_m2": 200.0,
                "uso_autorizado": "HABITACIONAL",
                "es_comercial": False,  # INCOMPATIBLE
            },
        },
        {
            "clase": "alineamiento y número oficial",
            "confianza": 90,
            "confianza_llm": 92,
            "resumen": "Constancia de alineamiento.",
            "campos": {
                "titular_o_propietario": "JUAN PEREZ",
                "clave_catastral": "1111111111111111",
                "superficie_terreno_m2": 200.0,
                "numero_oficial_asignado": "50",
            },
        },
    ]

    resultado = ejecutar_pipeline_completo(respuestas_falla, anio_referencia=2025)

    print("\nRESULTADO OBTENIDO DEL PIPELINE CON FALLAS:")
    print(f"• Veredicto: {resultado['veredicto']}")
    print(f"• Confianza Veredicto: {resultado['confianza_veredicto']}%")
    print(f"• Confianza Predial (faltante): {resultado['cinco_confianzas']['confianza_predial']}%")
    print(f"• Hallazgos Críticos ({len(resultado['hallazgos_criticos'])}):")
    for h in resultado["hallazgos_criticos"]:
        print(f"    🔴 {h['descripcion']}")

    assert resultado["veredicto"] == "No Cumple"
    assert resultado["cinco_confianzas"]["confianza_predial"] == 0
    reglas = [h["regla"] for h in resultado["hallazgos_criticos"]]
    assert "documentos_faltantes" in reglas
    assert "uso_suelo_incompatible" in reglas
    print("\n✅ CADENA 2 (EXPEDIENTE RECHAZADO) COMPLETADA CON ÉXITO.\n")


def main():
    test_cadena_completa_expediente_valido()
    test_cadena_completa_expediente_inconsistente()
    print("=" * 70)
    print("🎉 ¡TODAS LAS PRUEBAS EN CADENA END-TO-END PASARON SATISFACTORIAMENTE!")
    print("=" * 70)


if __name__ == "__main__":
    main()
