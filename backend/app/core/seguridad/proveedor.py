"""Construye los componentes de seguridad a partir de `settings`."""

from functools import lru_cache

from app.core.config import settings
from app.core.seguridad.cifrado import Cifrador, clave_desde_base64
from app.core.seguridad.errores import ConfiguracionSeguridadError


@lru_cache(maxsize=8)
def _cifrador(claves: tuple[tuple[str, str], ...], activa: str) -> Cifrador:
    return Cifrador({kid: clave_desde_base64(v, f"clave de cifrado '{kid}'") for kid, v in claves}, activa)


def obtener_cifrador() -> Cifrador:
    if not settings.claves_cifrado or not settings.clave_cifrado_activa:
        raise ConfiguracionSeguridadError(
            "Falta CLAVES_CIFRADO / CLAVE_CIFRADO_ACTIVA; genera claves con scripts/generar_claves.py"
        )
    return _cifrador(tuple(sorted(settings.claves_cifrado.items())), settings.clave_cifrado_activa)


def obtener_clave_indice() -> bytes:
    if not settings.clave_indice:
        raise ConfiguracionSeguridadError("Falta CLAVE_INDICE; genera claves con scripts/generar_claves.py")
    return clave_desde_base64(settings.clave_indice, "CLAVE_INDICE")


def obtener_pepper() -> bytes | None:
    if not settings.pepper_password:
        return None
    return clave_desde_base64(settings.pepper_password, "PEPPER_PASSWORD")
