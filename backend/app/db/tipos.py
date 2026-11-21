"""Tipos de columna que cifran el valor antes de guardarlo (AES-256-GCM, ver `core.seguridad`).

En la base queda texto ilegible (`enc1.<clave>...`). El `contexto` liga el valor a su columna:
si alguien lo copia a otra, no se puede descifrar.
"""

import json
from typing import Any

from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from app.core.seguridad.proveedor import obtener_cifrador


class TextoCifrado(TypeDecorator):
    impl = Text
    cache_ok = True

    def __init__(self, contexto: str):
        super().__init__()
        self.contexto = contexto

    def process_bind_param(self, value: str | None, dialect) -> str | None:
        if value is None:
            return None
        return obtener_cifrador().cifrar(value.encode("utf-8"), self.contexto)

    def process_result_value(self, value: str | None, dialect) -> str | None:
        if value is None:
            return None
        return obtener_cifrador().descifrar(value, self.contexto).decode("utf-8")


class JSONCifrado(TypeDecorator):
    impl = Text
    cache_ok = True

    def __init__(self, contexto: str):
        super().__init__()
        self.contexto = contexto

    def process_bind_param(self, value: Any, dialect) -> str | None:
        if value is None:
            return None
        texto = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        return obtener_cifrador().cifrar(texto.encode("utf-8"), self.contexto)

    def process_result_value(self, value: str | None, dialect) -> Any:
        if value is None:
            return None
        return json.loads(obtener_cifrador().descifrar(value, self.contexto))
