from datetime import date
from difflib import SequenceMatcher
from typing import Any, Optional

TIPOS_REQUERIDOS = [
    "predial",
    "escritura",
    "uso de suelo",
    "alineamiento y número oficial",
]


def calcular_similitud_nombres(nom1: Optional[str], nom2: Optional[str]) -> float:
    """Calcula similitud difflib entre dos nombres normalizados (0.0 a 1.0)."""
    if not nom1 or not nom2:
        return 0.0
    return SequenceMatcher(None, nom1.strip(), nom2.strip()).ratio()


def validar_expediente_cruzado(
    documentos: list[dict[str, Any]],
    anio_referencia: Optional[int] = None,
    tolerancia_superficie_revisar: float = 0.02,
    tolerancia_superficie_error: float = 0.05,
    umbral_similitud_nombre: float = 0.80,
    umbral_confianza_minima_doc: int = 70,
) -> dict[str, Any]:
    """Realiza la auditoría integral, validación cruzada y emisión de veredicto con 5 confianzas.

    Compila todos los hallazgos sin corte temprano para generar el dictamen exhaustivo.
    """
    if anio_referencia is None:
        anio_referencia = date.today().year

    hallazgos_criticos: list[dict[str, Any]] = []
    hallazgos_advertencias: list[dict[str, Any]] = []
    hallazgos_conformes: list[dict[str, Any]] = []

    # -------------------------------------------------------------------------
    # 1. Auditoría de Colección: Presencia, Faltantes y Repetidos
    # -------------------------------------------------------------------------
    docs_por_tipo: dict[str, list[dict[str, Any]]] = {t: [] for t in TIPOS_REQUERIDOS}
    docs_desconocidos: list[dict[str, Any]] = []

    for d in documentos:
        clase = d.get("clase", "ninguna")
        if clase in docs_por_tipo:
            docs_por_tipo[clase].append(d)
        else:
            docs_desconocidos.append(d)

    tipos_faltantes = [t for t, lista in docs_por_tipo.items() if len(lista) == 0]
    tipos_duplicados = [t for t, lista in docs_por_tipo.items() if len(lista) > 1]

    if tipos_faltantes:
        hallazgos_criticos.append(
            {
                "regla": "documentos_faltantes",
                "descripcion": f"Faltan {len(tipos_faltantes)} documento(s) obligatorio(s): {', '.join(tipos_faltantes)}.",
                "severidad": "CRITICO",
                "tipos": tipos_faltantes,
            }
        )

    if tipos_duplicados:
        hallazgos_criticos.append(
            {
                "regla": "documentos_duplicados",
                "descripcion": f"Se enviaron documentos duplicados de la misma clase: {', '.join(tipos_duplicados)}.",
                "severidad": "CRITICO",
                "tipos": tipos_duplicados,
            }
        )

    if docs_desconocidos:
        hallazgos_criticos.append(
            {
                "regla": "documento_no_reconocido",
                "descripcion": f"Se recibieron {len(docs_desconocidos)} archivo(s) no reconocidos o ilegibles.",
                "severidad": "CRITICO",
            }
        )

    # -------------------------------------------------------------------------
    # 2. Extracción de entidades y chequeo de confianza por documento
    # -------------------------------------------------------------------------
    claves_por_doc: dict[str, str] = {}
    superficies_por_doc: dict[str, float] = {}
    titulares_por_doc: dict[str, str] = {}
    direcciones_por_doc: dict[str, str] = {}
    numeros_oficiales: list[str] = []

    for tipo, lista in docs_por_tipo.items():
        if not lista:
            continue
        doc = lista[0]
        norm = doc.get("campos_normalizados", {}) or {}
        conf_doc = doc.get("confianza", 0)

        # Chequeo de calidad de escaneo / confianza mínima
        if conf_doc < umbral_confianza_minima_doc:
            hallazgos_advertencias.append(
                {
                    "regla": "confianza_clasificacion_baja",
                    "descripcion": (
                        f"El documento '{tipo}' tiene un nivel de confianza bajo ({conf_doc}%). "
                        "El escaneo podría estar borroso o incompleto; se recomienda inspección visual."
                    ),
                    "severidad": "ADVERTENCIA",
                    "tipo": tipo,
                    "confianza": conf_doc,
                }
            )

        # Clave catastral
        c_cat = norm.get("clave_catastral")
        if c_cat:
            claves_por_doc[tipo] = str(c_cat)

        # Superficie
        sup = norm.get("superficie_terreno_m2")
        if sup and sup > 0:
            superficies_por_doc[tipo] = float(sup)

        # Titular
        tit = (
            norm.get("titular_o_comprador")
            or norm.get("propietario_o_contribuyente")
            or norm.get("titular_o_solicitante")
            or norm.get("titular_o_propietario")
        )
        if tit:
            titulares_por_doc[tipo] = str(tit)

        # Dirección
        dir_doc = norm.get("direccion_inmueble") or norm.get("direccion") or norm.get("direccion_oficial")
        if dir_doc:
            direcciones_por_doc[tipo] = str(dir_doc)

        # Número oficial
        num_of = norm.get("numero_oficial_asignado")
        if num_of and str(num_of).upper() not in ["SN", "S/N", "NONE"]:
            numeros_oficiales.append(str(num_of))

    # -------------------------------------------------------------------------
    # 3. Validación Cruzada: Clave Catastral (Identificador Maestro)
    # -------------------------------------------------------------------------
    if len(claves_por_doc) > 1:
        claves_unicas = set(claves_por_doc.values())
        if len(claves_unicas) == 1:
            hallazgos_conformes.append(
                {
                    "regla": "clave_catastral_identica",
                    "descripcion": f"Clave catastral coincidente en {len(claves_por_doc)} documentos: {list(claves_unicas)[0]}.",
                }
            )
        else:
            detalle = ", ".join(f"{t}: {c}" for t, c in claves_por_doc.items())
            hallazgos_criticos.append(
                {
                    "regla": "discrepancia_clave_catastral",
                    "descripcion": f"INCONSISTENCIA GRAVE: Claves catastrales distintas entre documentos ({detalle}). Posible expediente mezclado.",
                    "severidad": "CRITICO",
                }
            )
    elif len(claves_por_doc) == 1:
        hallazgos_advertencias.append(
            {
                "regla": "clave_catastral_parcial",
                "descripcion": f"Solo un documento tiene clave catastral identificable ({list(claves_por_doc.keys())[0]}).",
                "severidad": "ADVERTENCIA",
            }
        )

    # -------------------------------------------------------------------------
    # 4. Validación Cruzada: Superficie de Terreno (con tolerancias)
    # -------------------------------------------------------------------------
    if len(superficies_por_doc) > 1:
        valores_sup = list(superficies_por_doc.values())
        min_s = min(valores_sup)
        max_s = max(valores_sup)
        dif_relativa = (max_s - min_s) / min_s if min_s > 0 else 0.0

        detalle_sup = ", ".join(f"{t}: {s:.2f} m²" for t, s in superficies_por_doc.items())

        # Comparación con redondeo a 4 decimales para evitar problemas de precisión flotante
        dif_redondeada = round(dif_relativa, 4)

        if dif_redondeada <= tolerancia_superficie_revisar:
            hallazgos_conformes.append(
                {
                    "regla": "superficie_coherente",
                    "descripcion": f"Superficies de terreno coincidentes dentro del margen permitido (variación: {dif_relativa*100:.2f}%): {detalle_sup}.",
                }
            )
        elif dif_redondeada <= tolerancia_superficie_error:
            hallazgos_advertencias.append(
                {
                    "regla": "superficie_discrepancia_menor",
                    "descripcion": f"Variación menor de superficie ({dif_relativa*100:.2f}%): {detalle_sup}. Requiere revisión de deslinde.",
                    "severidad": "ADVERTENCIA",
                }
            )
        else:
            hallazgos_criticos.append(
                {
                    "regla": "superficie_discrepancia_grave",
                    "descripcion": f"INCONSISTENCIA GRAVE de superficie (diferencia del {dif_relativa*100:.2f}%): {detalle_sup}.",
                    "severidad": "CRITICO",
                }
            )

    # -------------------------------------------------------------------------
    # 5. Validación Cruzada: Titulares y Propietarios (Similitud Difflib)
    # -------------------------------------------------------------------------
    if len(titulares_por_doc) > 1:
        tipos_tit = list(titulares_por_doc.keys())
        discrepancias_nombres = []

        for i in range(len(tipos_tit)):
            for j in range(i + 1, len(tipos_tit)):
                t1_tipo = tipos_tit[i]
                t2_tipo = tipos_tit[j]
                nom1 = titulares_por_doc[t1_tipo]
                nom2 = titulares_por_doc[t2_tipo]
                sim = calcular_similitud_nombres(nom1, nom2)

                if sim < umbral_similitud_nombre:
                    discrepancias_nombres.append(
                        f"{t1_tipo} ('{nom1}') vs {t2_tipo} ('{nom2}') [similitud: {int(sim*100)}%]"
                    )

        if not discrepancias_nombres:
            hallazgos_conformes.append(
                {
                    "regla": "titular_coincidente",
                    "descripcion": "Nombres de titulares coincidentes en los documentos analizados.",
                }
            )
        else:
            hallazgos_advertencias.append(
                {
                    "regla": "discrepancia_titulares",
                    "descripcion": f"Diferencia en el titular registrado entre documentos: {'; '.join(discrepancias_nombres)}. Verificar si medió compraventa reciente.",
                    "severidad": "ADVERTENCIA",
                }
            )

    # -------------------------------------------------------------------------
    # 6. Regla Clave: Predial Vigente y Comprobante de Pago Acreditado
    # -------------------------------------------------------------------------
    docs_predial = docs_por_tipo.get("predial", [])
    if docs_predial:
        pred_norm = docs_predial[0].get("campos_normalizados", {})
        es_pago = pred_norm.get("es_comprobante_pago")
        anio_p = pred_norm.get("ejercicio_anio")

        if es_pago is False:
            hallazgos_criticos.append(
                {
                    "regla": "predial_no_acreditado",
                    "descripcion": "El predial anexado es una orden o formato para pago en ventanilla sin sello ni acreditación de pago.",
                    "severidad": "CRITICO",
                }
            )
        elif es_pago is True:
            hallazgos_conformes.append(
                {
                    "regla": "predial_pago_acreditado",
                    "descripcion": "El predial cuenta con certificación, sello digital o comprobante de pago válido.",
                }
            )

        if anio_p:
            if anio_p >= anio_referencia:
                hallazgos_conformes.append(
                    {
                        "regla": "predial_vigente",
                        "descripcion": f"El predial está al corriente (ejercicio fiscal {anio_p}).",
                    }
                )
            else:
                hallazgos_criticos.append(
                    {
                        "regla": "predial_vencido",
                        "descripcion": f"El predial no está vigente (corresponde a {anio_p}, año en curso {anio_referencia}).",
                        "severidad": "CRITICO",
                    }
                )

    # -------------------------------------------------------------------------
    # 7. Regla de Negocio: Uso de Suelo Comercial
    # -------------------------------------------------------------------------
    docs_uso = docs_por_tipo.get("uso de suelo", [])
    if docs_uso:
        uso_norm = docs_uso[0].get("campos_normalizados", {})
        es_comercial = uso_norm.get("es_comercial")
        uso_aut = uso_norm.get("uso_autorizado") or ""

        if es_comercial is False or "HABITACIONAL" in uso_aut.upper():
            hallazgos_criticos.append(
                {
                    "regla": "uso_suelo_incompatible",
                    "descripcion": f"Uso de suelo '{uso_aut}' incompatible: no autoriza actividades comerciales de tienda.",
                    "severidad": "CRITICO",
                }
            )
        elif es_comercial is True:
            hallazgos_conformes.append(
                {
                    "regla": "uso_suelo_comercial",
                    "descripcion": f"Uso de suelo autorizado compatible con actividad comercial ({uso_aut}).",
                }
            )

    # -------------------------------------------------------------------------
    # 8. Determinación del Veredicto y Cálculo de las 5 Confianzas
    # -------------------------------------------------------------------------
    confianzas_docs = {
        "predial": docs_por_tipo["predial"][0].get("confianza", 0) if docs_por_tipo["predial"] else 0,
        "escritura": docs_por_tipo["escritura"][0].get("confianza", 0) if docs_por_tipo["escritura"] else 0,
        "uso_de_suelo": docs_por_tipo["uso de suelo"][0].get("confianza", 0) if docs_por_tipo["uso de suelo"] else 0,
        "alineamiento_y_numero_oficial": docs_por_tipo["alineamiento y número oficial"][0].get("confianza", 0) if docs_por_tipo["alineamiento y número oficial"] else 0,
    }

    # Docs con confianza > 0
    docs_validos = [c for c in confianzas_docs.values() if c > 0]
    promedio_docs = sum(docs_validos) / max(len(docs_validos), 1)

    if hallazgos_criticos:
        veredicto = "No Cumple"
        # Alta certeza del rechazo si los hallazgos críticos están bien documentados
        # Penaliza si los documentos eran muy dudosos o incompletos
        factor_completitud = len(docs_validos) / 4.0
        confianza_veredicto = int(min(98, max(70, promedio_docs * 0.8 + factor_completitud * 20)))
    elif hallazgos_advertencias:
        veredicto = "Requiere Revisión"
        # La confianza del veredicto refleja que no se puede automatizar la aprobación:
        # Se sitúa en rango de revisión humana (60-85%)
        penalizacion_advertencias = len(hallazgos_advertencias) * 6
        confianza_veredicto = int(max(55, min(85, promedio_docs - penalizacion_advertencias)))
    else:
        veredicto = "Cumple"
        # Aprobación limpia: promedio ponderado de calidad de los 4 documentos
        confianza_veredicto = int(min(99, max(85, promedio_docs)))

    cinco_confianzas = {
        "confianza_predial": confianzas_docs["predial"],
        "confianza_escritura": confianzas_docs["escritura"],
        "confianza_uso_de_suelo": confianzas_docs["uso_de_suelo"],
        "confianza_alineamiento_y_numero_oficial": confianzas_docs["alineamiento_y_numero_oficial"],
        "confianza_veredicto_final": confianza_veredicto,
    }

    explicacion = _generar_explicativa_ejecutiva(
        veredicto=veredicto,
        hallazgos_criticos=hallazgos_criticos,
        hallazgos_advertencias=hallazgos_advertencias,
        hallazgos_conformes=hallazgos_conformes,
        confianzas_docs=confianzas_docs,
        confianza_veredicto=confianza_veredicto,
    )

    return {
        "veredicto": veredicto,
        "confianza_veredicto": confianza_veredicto,
        "confianzas_por_documento": confianzas_docs,
        "cinco_confianzas": cinco_confianzas,
        "explicacion": explicacion,
        "hallazgos_criticos": hallazgos_criticos,
        "hallazgos_advertencias": hallazgos_advertencias,
        "hallazgos_conformes": hallazgos_conformes,
        "documentos_procesados": len(documentos),
        "resumen_coleccion": {
            "tipos_presentes": [t for t, l in docs_por_tipo.items() if l],
            "tipos_faltantes": tipos_faltantes,
            "tipos_duplicados": tipos_duplicados,
        },
    }


def _generar_explicativa_ejecutiva(
    veredicto: str,
    hallazgos_criticos: list[dict[str, Any]],
    hallazgos_advertencias: list[dict[str, Any]],
    hallazgos_conformes: list[dict[str, Any]],
    confianzas_docs: dict[str, int],
    confianza_veredicto: int,
) -> str:
    """Genera la narrativa estructurada y profesional del dictamen del expediente."""
    lineas = []
    lineas.append(f"### DICTAMEN DE AUDITORÍA: {veredicto.upper()} (Certeza: {confianza_veredicto}%)")
    lineas.append("")

    if veredicto == "No Cumple":
        lineas.append(
            "El expediente fue calificado como **NO CUMPLE** debido a inconsistencias o incumplimientos "
            "normativos que impiden continuar con el trámite de apertura:"
        )
        for h in hallazgos_criticos:
            lineas.append(f"- 🔴 **{h['regla'].replace('_', ' ').capitalize()}**: {h['descripcion']}")
    elif veredicto == "Requiere Revisión":
        lineas.append(
            "El expediente cuenta con los documentos requeridos pero presenta observaciones menores "
            "que deben ser valoradas por la mesa de control legal:"
        )
        for h in hallazgos_advertencias:
            lineas.append(f"- 🟡 **{h['regla'].replace('_', ' ').capitalize()}**: {h['descripcion']}")
    else:
        lineas.append(
            "El expediente **CUMPLE** satisfactoriamente con la totalidad de los requisitos documentales, "
            "vigencia fiscal y consistencia jurídica entre predial, escritura, uso de suelo y alineamiento."
        )

    if hallazgos_conformes:
        lineas.append("")
        lineas.append("#### Puntos conformes verificados:")
        for h in hallazgos_conformes:
            lineas.append(f"- 🟢 {h['descripcion']}")

    lineas.append("")
    lineas.append("#### 5 Niveles de Confianza del Expediente:")
    lineas.append(f"1. Boleta Predial: **{confianzas_docs['predial']}%**")
    lineas.append(f"2. Escritura Notarial: **{confianzas_docs['escritura']}%**")
    lineas.append(f"3. Licencia de Uso de Suelo: **{confianzas_docs['uso_de_suelo']}%**")
    lineas.append(f"4. Alineamiento y Número Oficial: **{confianzas_docs['alineamiento_y_numero_oficial']}%**")
    lineas.append(f"5. **Confianza Global del Dictamen: {confianza_veredicto}%**")

    return "\n".join(lineas)
