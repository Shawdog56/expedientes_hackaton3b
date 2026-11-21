"""Índices ciegos: HMAC-SHA256 para buscar por igualdad un dato que está cifrado.

Guarda el dato cifrado en una columna y este índice en otra con `index=True`; la búsqueda
compara índices sin descifrar nada. La clave es distinta de las de cifrado y el contexto
(p. ej. `extracciones.folio`) separa los índices de campos distintos.
"""

import hashlib
import hmac
import unicodedata

from app.core.seguridad.proveedor import obtener_clave_indice


def normalizar(valor: str) -> str:
    """Quita espacios y diferencias de mayúsculas o de compatibilidad Unicode."""
    return unicodedata.normalize("NFKC", valor).strip().upper()


def indice_ciego(valor: str, contexto: str, clave: bytes | None = None) -> str:
    mensaje = f"{contexto}\0{normalizar(valor)}".encode("utf-8")
    return hmac.new(clave or obtener_clave_indice(), mensaje, hashlib.sha256).hexdigest()
