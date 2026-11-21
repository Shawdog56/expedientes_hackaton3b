"""Contraseñas con Argon2id y pepper opcional.

Parámetros por encima del mínimo de OWASP (m=19 MiB, t=2, p=1). Si el servidor lo permite,
súbelos: `verificar_password` detecta el hash viejo y devuelve el nuevo.
"""

import hashlib
import hmac

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.seguridad.proveedor import obtener_pepper

_hasher = PasswordHasher(time_cost=3, memory_cost=64 * 1024, parallelism=4)


def _con_pepper(password: str) -> str:
    pepper = obtener_pepper()
    if pepper is None:
        return password
    return hmac.new(pepper, password.encode("utf-8"), hashlib.sha256).hexdigest()


def hashear_password(password: str) -> str:
    return _hasher.hash(_con_pepper(password))


def verificar_password(password: str, hash_guardado: str) -> tuple[bool, str | None]:
    """Devuelve (correcta, hash_nuevo). `hash_nuevo` solo viene si hay que actualizar el guardado."""
    try:
        _hasher.verify(hash_guardado, _con_pepper(password))
    except (VerificationError, InvalidHashError):
        return False, None
    if _hasher.check_needs_rehash(hash_guardado):
        return True, hashear_password(password)
    return True, None
