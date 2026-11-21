"""Tokens entre entidades: JWT firmado con RSA (RS256) y, opcionalmente, cifrado (JWE).

- Firmar da autenticidad e integridad: el emisor firma con su clave privada y el receptor
  verifica con la pública de ese emisor.
- Cifrar da confidencialidad: el emisor cifra con la clave pública del receptor y solo este
  lo abre con su privada. Se firma primero y se cifra después (JWS anidado en JWE, `cty: JWT`).

Son funciones puras: reciben las claves en PEM y no leen `settings`.
"""

import base64
import json
import time
import uuid
from collections.abc import Mapping
from typing import Any

from joserfc import jwe, jwt
from joserfc.errors import JoseError
from joserfc.jwk import RSAKey

from app.core.seguridad.errores import ConfiguracionSeguridadError, TokenInvalido

ALG_FIRMA = "RS256"
ALG_CLAVE = "RSA-OAEP-256"
ALG_CIFRADO = "A256GCM"

TTL_POR_DEFECTO = 300
TTL_MAXIMO = 900
HOLGURA = 30

_ERRORES_FORMATO = (JoseError, ValueError, KeyError, TypeError, AttributeError)


def _clave_rsa(pem: str | bytes) -> RSAKey:
    try:
        return RSAKey.import_key(pem)
    except _ERRORES_FORMATO:
        raise ConfiguracionSeguridadError("Clave RSA inválida") from None


def emitir_token(
    *,
    emisor: str,
    audiencia: str,
    clave_privada_pem: str | bytes,
    sujeto: str | None = None,
    ttl: int = TTL_POR_DEFECTO,
    extra: Mapping[str, Any] | None = None,
    clave_publica_destino_pem: str | bytes | None = None,
    ahora: int | None = None,
) -> str:
    """Emite un JWT RS256. Con `clave_publica_destino_pem` lo devuelve cifrado (JWE)."""
    instante = int(time.time()) if ahora is None else ahora
    claims: dict[str, Any] = {
        **(extra or {}),
        "iss": emisor,
        "sub": sujeto or emisor,
        "aud": audiencia,
        "iat": instante,
        "exp": instante + ttl,
        "jti": uuid.uuid4().hex,
    }
    firmado = jwt.encode(
        {"alg": ALG_FIRMA, "kid": emisor}, claims, _clave_rsa(clave_privada_pem), algorithms=[ALG_FIRMA]
    )
    if clave_publica_destino_pem is None:
        return firmado
    return jwe.encrypt_compact(
        {"alg": ALG_CLAVE, "enc": ALG_CIFRADO, "cty": "JWT"},
        firmado,
        _clave_rsa(clave_publica_destino_pem),
        algorithms=[ALG_CLAVE, ALG_CIFRADO],
    )


def _cabecera(token: str) -> dict[str, Any]:
    """Cabecera sin verificar: solo sirve para elegir la clave; la firma se comprueba después."""
    primero = token.split(".", 1)[0]
    cabecera = json.loads(base64.urlsafe_b64decode(primero + "=" * (-len(primero) % 4)))
    if not isinstance(cabecera, dict):
        raise ValueError("cabecera inválida")
    return cabecera


def verificar_token(
    token: str,
    *,
    claves_emisores: Mapping[str, str | bytes],
    audiencia: str,
    clave_privada_cifrado_pem: str | bytes | None = None,
    exigir_cifrado: bool = False,
    ttl_maximo: int = TTL_MAXIMO,
    holgura: int = HOLGURA,
    ahora: int | None = None,
) -> dict[str, Any]:
    """Valida el token y devuelve sus claims; lanza `TokenInvalido` si algo falla."""
    instante = int(time.time()) if ahora is None else ahora
    try:
        segmentos = token.count(".") + 1
        if segmentos == 5:
            if clave_privada_cifrado_pem is None:
                raise TokenInvalido("Esta API no acepta tokens cifrados")
            abierto = jwe.decrypt_compact(
                token, _clave_rsa(clave_privada_cifrado_pem), algorithms=[ALG_CLAVE, ALG_CIFRADO]
            )
            if abierto.protected.get("cty") != "JWT":
                raise TokenInvalido("El contenido cifrado no es un JWT")
            firmado = bytes(abierto.plaintext).decode("ascii")
        elif segmentos == 3:
            if exigir_cifrado:
                raise TokenInvalido("Se exige un token cifrado")
            firmado = token
        else:
            raise TokenInvalido("Formato de token inválido")

        cabecera = _cabecera(firmado)
        emisor = cabecera.get("kid")
        if cabecera.get("alg") != ALG_FIRMA or not isinstance(emisor, str):
            raise TokenInvalido("Algoritmo o emisor no permitido")
        clave_emisor = claves_emisores.get(emisor)
        if clave_emisor is None:
            raise TokenInvalido("Emisor desconocido")

        decodificado = jwt.decode(firmado, _clave_rsa(clave_emisor), algorithms=[ALG_FIRMA])
        claims = dict(decodificado.claims)
        jwt.JWTClaimsRegistry(
            now=instante,
            leeway=holgura,
            iss={"essential": True, "value": emisor},
            aud={"essential": True, "value": audiencia},
            exp={"essential": True},
            iat={"essential": True},
            jti={"essential": True},
        ).validate(claims)
        if claims["iat"] > instante + holgura or claims["exp"] - claims["iat"] > ttl_maximo:
            raise TokenInvalido("Vigencia del token fuera de política")
        return claims
    except TokenInvalido:
        raise
    except ConfiguracionSeguridadError:
        raise
    except _ERRORES_FORMATO:
        raise TokenInvalido("Token inválido") from None
