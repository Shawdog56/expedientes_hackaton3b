import re
import unicodedata
from typing import Any, Optional


def limpiar_texto(texto: Optional[str]) -> Optional[str]:
    """Elimina espacios redundantes y limpia caracteres invisibles."""
    if not texto:
        return None
    limpio = re.sub(r"\s+", " ", str(texto)).strip()
    return limpio if limpio else None


def remover_acentos(texto: Optional[str]) -> Optional[str]:
    """Convierte texto a mayúsculas y retira acentos (preservando Ñ)."""
    if not texto:
        return None
    t = texto.replace("Ñ", "___ENIE_MAY___").replace("ñ", "___ENIE_MIN___")
    forma_nfd = unicodedata.normalize("NFD", t)
    sin_diacriticos = "".join(c for c in forma_nfd if unicodedata.category(c) != "Mn")
    restaurado = (
        sin_diacriticos.replace("___ENIE_MAY___", "Ñ")
        .replace("___ENIE_MIN___", "Ñ")
        .upper()
    )
    return limpiar_texto(restaurado)


def normalizar_clave_catastral(clave: Optional[str]) -> Optional[str]:
    """Extrae únicamente la secuencia de dígitos de la clave catastral.

    Ejemplos:
      '007-01-511-26-00-00000' -> '00701511260000000'
      '112 03 145 18 00 0000'  -> '1120314518000000'
      '0040111241000000'       -> '0040111241000000'
    """
    if not clave:
        return None
    digitos = re.sub(r"[^0-9A-Za-z]", "", str(clave).upper())
    return digitos if len(digitos) >= 8 else None


def normalizar_nombre_persona(nombre: Optional[str]) -> Optional[str]:
    """Normaliza nombres de personas o empresas para comparación.

    Elimina títulos profesionales (LIC, ING, DRA, etc.) y signos de puntuación.
    """
    if not nombre:
        return None
    n = remover_acentos(nombre)
    if not n:
        return None

    # Eliminar prefijos honoríficos o títulos comunes
    prefijos = [
        r"^LIC\.\s*",
        r"^LICENCIAD[OA]\s*",
        r"^ING\.\s*",
        r"^INGENIER[OA]\s*",
        r"^ARQ\.\s*",
        r"^ARQUITECT[OA]\s*",
        r"^DR\.\s*",
        r"^DRA\.\s*",
        r"^DOCTOR[A]?\s*",
        r"^C\.\s*",
        r"^SR\.\s*",
        r"^SRA\.\s*",
    ]
    for p in prefijos:
        n = re.sub(p, "", n, flags=re.IGNORECASE)

    # Eliminar cualquier caracter que no sea letra o espacio
    n = re.sub(r"[^A-ZÑ\s]", " ", n)
    return limpiar_texto(n)


def normalizar_superficie(valor: Any) -> Optional[float]:
    """Extrae y convierte cualquier formato de superficie a float (m²).

    Ejemplos:
      '536.82 M²' -> 536.82
      '1,262.50'   -> 1262.50
      537          -> 537.0
    """
    if valor is None:
        return None
    if isinstance(valor, (int, float)):
        return float(valor)

    s = str(valor).replace(",", "")
    match = re.search(r"(\d+(?:\.\d+)?)", s)
    if match:
        try:
            return round(float(match.group(1)), 2)
        except ValueError:
            return None
    return None


def extraer_anio(texto_o_fecha: Optional[str]) -> Optional[int]:
    """Extrae un año de 4 dígitos de una fecha o texto.

    Maneja ruidos de OCR como '016/10/2025' o '25/01/2024'.
    """
    if not texto_o_fecha:
        return None
    match = re.search(r"\b(19\d{2}|20\d{2})\b", str(texto_o_fecha))
    if match:
        return int(match.group(1))
    return None


def normalizar_direccion(dir_texto: Optional[str]) -> Optional[str]:
    """Normaliza abreviaturas comunes en domicilios para facilitar el cruce."""
    if not dir_texto:
        return None
    d = remover_acentos(dir_texto)
    if not d:
        return None

    reemplazos = {
        r"\bAVENIDA\b": "AV",
        r"\bAV\.\b": "AV",
        r"\bCALLE\b": "C",
        r"\bC\.\b": "C",
        r"\bCOLONIA\b": "COL",
        r"\bCOL\.\b": "COL",
        r"\bNUMERO\b": "NO",
        r"\bNUM\.\b": "NO",
        r"\bNO\.\b": "NO",
        r"\bSIN NUMERO\b": "SN",
        r"\bS/N\b": "SN",
        r"\bS / N\b": "SN",
        r"\bFRACCIONAMIENTO\b": "FRACC",
        r"\bFRACC\.\b": "FRACC",
    }
    for patron, reemplazo in reemplazos.items():
        d = re.sub(patron, reemplazo, d, flags=re.IGNORECASE)

    d = re.sub(r"[,;:\(\)]", " ", d)
    return limpiar_texto(d)
