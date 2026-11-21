"""Autenticación entre entidades: JWT firmado (RS256) y, si se configura, cifrado (JWE)."""

from pathlib import Path
from typing import Any

from fastapi import Header, HTTPException, status

from app.core.config import settings
from app.core.seguridad.errores import ConfiguracionSeguridadError, TokenInvalido
from app.core.seguridad.tokens import verificar_token

_NO_AUTORIZADO = {"WWW-Authenticate": "Bearer"}


def _claves_emisores() -> dict[str, bytes]:
    carpeta = settings.auth_claves_emisores_dir
    if carpeta is None or not Path(carpeta).is_dir():
        raise ConfiguracionSeguridadError("AUTH_CLAVES_EMISORES_DIR no apunta a una carpeta")
    return {archivo.stem: archivo.read_bytes() for archivo in sorted(Path(carpeta).glob("*.pem"))}


def requiere_entidad(authorization: str | None = Header(default=None)) -> dict[str, Any] | None:
    """Con `AUTH_REQUERIDA=false` deja pasar; con `true` exige un token válido y devuelve sus claims."""
    if not settings.auth_requerida:
        return None
    esquema, _, token = (authorization or "").partition(" ")
    if esquema.lower() != "bearer" or not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Falta el token", headers=_NO_AUTORIZADO)
    try:
        privada = settings.auth_clave_cifrado_privada
        return verificar_token(
            token,
            claves_emisores=_claves_emisores(),
            audiencia=settings.auth_audiencia,
            clave_privada_cifrado_pem=privada.read_bytes() if privada else None,
            exigir_cifrado=settings.auth_exigir_cifrado,
            ttl_maximo=settings.auth_ttl_maximo_seg,
        )
    except TokenInvalido:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Token inválido", headers=_NO_AUTORIZADO
        ) from None
    except ConfiguracionSeguridadError:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Autenticación mal configurada en el servidor"
        ) from None
