from datetime import date
from typing import Any, Optional

from app.services.normalizacion import (
    extraer_anio,
    limpiar_texto,
    normalizar_clave_catastral,
    normalizar_direccion,
    normalizar_nombre_persona,
    normalizar_superficie,
)

CAMPOS_INDISPENSABLES_POR_CLASE: dict[str, list[str]] = {
    "predial": [
        "clave_catastral",
        "ejercicio_o_periodo",
        "total_pagado",
        "es_comprobante_pago",
    ],
    "escritura": [
        "titular_o_comprador",
        "direccion_inmueble",
        "superficie_terreno_m2",
        "numero_escritura_o_instrumento",
    ],
    "uso de suelo": [
        "uso_autorizado",
        "es_comercial",
        "direccion_inmueble",
    ],
    "alineamiento y número oficial": [
        "direccion_oficial",
        "numero_oficial_asignado",
        "superficie_terreno_m2",
    ],
}

CAMPOS_DESEABLES_POR_CLASE: dict[str, list[str]] = {
    "predial": [
        "superficie_terreno_m2",
        "propietario_o_contribuyente",
        "folio_o_recibo",
        "valor_catastral",
        "direccion",
    ],
    "escritura": [
        "clave_catastral",
        "medidas_y_colindancias",
        "notario_y_notaria",
        "fecha_escritura",
        "tipo_acto",
    ],
    "uso de suelo": [
        "clave_catastral",
        "giro_permitido",
        "vigencia",
        "superficie_terreno_m2",
        "folio_o_expediente",
    ],
    "alineamiento y número oficial": [
        "clave_catastral",
        "titular_o_propietario",
        "fecha_emision",
        "vigencia",
        "folio_o_expediente",
        "alineamiento_medidas",
    ],
}


def _normalizar_campos_por_clase(clase: str, campos_raw: dict[str, Any]) -> dict[str, Any]:
    """Genera un diccionario normalizado con valores tipados y limpios."""
    normalizados: dict[str, Any] = {}

    for k, v in campos_raw.items():
        if v is None:
            normalizados[k] = None
            continue

        if "clave_catastral" in k:
            normalizados[k] = normalizar_clave_catastral(str(v))
        elif "superficie" in k or "valor" in k or "total" in k:
            normalizados[k] = normalizar_superficie(v)
        elif "titular" in k or "comprador" in k or "propietario" in k or "vendedor" in k:
            normalizados[k] = normalizar_nombre_persona(str(v))
        elif "direccion" in k:
            normalizados[k] = normalizar_direccion(str(v))
        elif isinstance(v, bool):
            normalizados[k] = v
        else:
            normalizados[k] = limpiar_texto(str(v))

    # Extracción de año de ejercicio para predial
    if clase == "predial":
        ejercicio_raw = campos_raw.get("ejercicio_o_periodo")
        normalizados["ejercicio_anio"] = extraer_anio(ejercicio_raw)

    return normalizados


def validar_documento_individual(
    doc: dict[str, Any], anio_referencia: Optional[int] = None
) -> dict[str, Any]:
    """Analiza la estructura interna de un documento, detecta datos faltantes,

    normaliza campos para comparación y emite observaciones legales preliminares.
    """
    if anio_referencia is None:
        anio_referencia = date.today().year

    clase = doc.get("clase", "ninguna")
    campos_raw = doc.get("campos", {}) or {}
    campos_normalizados = _normalizar_campos_por_clase(clase, campos_raw)

    faltantes_criticos: list[str] = []
    faltantes_opcionales: list[str] = []
    observaciones: list[str] = []
    estado_doc = "valido"

    if clase == "ninguna":
        estado_doc = "invalido"
        observaciones.append(
            "El documento no corresponde a ninguna de las 4 categorías requeridas "
            "(predial, escritura, uso de suelo, alineamiento y número oficial) o el texto es ilegible."
        )
        return {
            **doc,
            "campos_normalizados": {},
            "campos_faltantes_criticos": ["documento_valido"],
            "campos_faltantes_opcionales": [],
            "observaciones": observaciones,
            "estado_documento": estado_doc,
        }

    # 1. Chequeo de campos indispensables
    indispensables = CAMPOS_INDISPENSABLES_POR_CLASE.get(clase, [])
    for campo in indispensables:
        val = campos_normalizados.get(campo)
        if val is None or val == "":
            faltantes_criticos.append(campo)

    # 2. Chequeo de campos deseables
    deseables = CAMPOS_DESEABLES_POR_CLASE.get(clase, [])
    for campo in deseables:
        val = campos_normalizados.get(campo)
        if val is None or val == "":
            faltantes_opcionales.append(campo)

    # 3. Reglas de negocio específicas por tipo de documento
    if clase == "predial":
        # Comprobante de pago vs formato de captura
        es_pago = campos_normalizados.get("es_comprobante_pago")
        if es_pago is False:
            observaciones.append(
                "El documento presentado es un formato universal para pago o línea de captura; "
                "NO ACREDITA PAGO (carece de sello de caja, certificación bancaria o CFDI)."
            )
            estado_doc = "invalido"
        elif es_pago is None:
            observaciones.append(
                "No fue posible determinar con certeza si el predial cuenta con sello de pago emitido."
            )

        # Vigencia del predial
        anio_doc = campos_normalizados.get("ejercicio_anio")
        if anio_doc:
            if anio_doc < anio_referencia:
                observaciones.append(
                    f"El pago del impuesto predial corresponde al ejercicio fiscal {anio_doc}, "
                    f"no está actualizado al año en curso ({anio_referencia})."
                )
                if estado_doc != "invalido":
                    estado_doc = "con_observaciones"
        else:
            observaciones.append(
                "No se especificó claramente el año o ejercicio fiscal cubierto en el predial."
            )

    elif clase == "escritura":
        if "superficie_terreno_m2" in faltantes_criticos:
            observaciones.append(
                "No se localizó la superficie amparada del predio en el instrumento notarial."
            )
        if "titular_o_comprador" in faltantes_criticos:
            observaciones.append(
                "No se identificó al titular, comprador o beneficiario adjudicado en la escritura."
            )

    elif clase == "uso de suelo":
        # Compatibilidad comercial
        es_comercial = campos_normalizados.get("es_comercial")
        uso_aut = str(campos_normalizados.get("uso_autorizado") or "").upper()
        if es_comercial is False or "HABITACIONAL" in uso_aut:
            observaciones.append(
                f"El uso de suelo autorizado es '{uso_aut or 'No Comercial'}', "
                "el cual es INCOMPATIBLE con el uso comercial requerido para tienda o minisúper."
            )
            estado_doc = "invalido"

    elif clase == "alineamiento y número oficial":
        num_oficial = str(campos_normalizados.get("numero_oficial_asignado") or "").upper()
        if not num_oficial or num_oficial in ["SN", "S/N", "NONE"]:
            observaciones.append(
                "El documento no asigna un número oficial definitivo (figura sin número o 'S/N')."
            )

    # Determinar estado final del documento
    if faltantes_criticos:
        observaciones.append(
            f"Faltan datos indispensables para la validación: {', '.join(faltantes_criticos)}."
        )
        if estado_doc != "invalido":
            estado_doc = "con_observaciones"

    return {
        **doc,
        "campos_normalizados": campos_normalizados,
        "campos_faltantes_criticos": faltantes_criticos,
        "campos_faltantes_opcionales": faltantes_opcionales,
        "observaciones": observaciones,
        "estado_documento": estado_doc,
    }
