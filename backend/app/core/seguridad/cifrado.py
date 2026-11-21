"""Cifrado de campos con AES-256-GCM y cifrado por sobre (envelope encryption).

Cada valor se cifra con una clave de datos (DEK) aleatoria y única. La DEK se guarda
envuelta con una clave maestra (KEK) identificada por `kid`. Rotar la KEK solo obliga a
reenvolver las DEK; no hay que reconstruir el dato. El `contexto` (p. ej.
`extracciones.caracteristicas`) se autentica como datos asociados: un valor copiado a
otra columna no se puede descifrar.

Formato: ``enc1.<kid>.<dek envuelta>.<nonce>.<texto cifrado>`` (base64url sin relleno).
"""

import base64
import binascii
import os
from collections.abc import Mapping

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.seguridad.errores import ConfiguracionSeguridadError, DescifradoError

PREFIJO = "enc1"
LONGITUD_CLAVE = 32
LONGITUD_NONCE = 12


def _b64(datos: bytes) -> str:
    return base64.urlsafe_b64encode(datos).rstrip(b"=").decode("ascii")


def _desb64(texto: str) -> bytes:
    return base64.urlsafe_b64decode(texto + "=" * (-len(texto) % 4))


def clave_desde_base64(valor: str, nombre: str) -> bytes:
    """Decodifica una clave de 32 bytes en base64 (estándar o URL)."""
    normalizado = valor.strip().replace("+", "-").replace("/", "_").rstrip("=")
    try:
        clave = _desb64(normalizado)
    except (binascii.Error, ValueError):
        raise ConfiguracionSeguridadError(f"{nombre} no es base64 válido") from None
    if len(clave) != LONGITUD_CLAVE:
        raise ConfiguracionSeguridadError(f"{nombre} debe ser de {LONGITUD_CLAVE} bytes")
    return clave


class Cifrador:
    def __init__(self, claves: Mapping[str, bytes], activa: str):
        if activa not in claves:
            raise ConfiguracionSeguridadError("La clave de cifrado activa no está en el llavero")
        for kid, clave in claves.items():
            if not kid or "." in kid:
                raise ConfiguracionSeguridadError("Identificador de clave inválido")
            if len(clave) != LONGITUD_CLAVE:
                raise ConfiguracionSeguridadError(f"La clave '{kid}' debe ser de 32 bytes")
        self._claves = dict(claves)
        self._activa = activa

    @property
    def activa(self) -> str:
        return self._activa

    def cifrar(self, datos: bytes, contexto: str) -> str:
        aad = contexto.encode("utf-8")
        dek = AESGCM.generate_key(bit_length=256)
        nonce = os.urandom(LONGITUD_NONCE)
        cifrado = AESGCM(dek).encrypt(nonce, datos, aad)
        nonce_dek = os.urandom(LONGITUD_NONCE)
        dek_envuelta = nonce_dek + AESGCM(self._claves[self._activa]).encrypt(nonce_dek, dek, aad)
        return ".".join((PREFIJO, self._activa, _b64(dek_envuelta), _b64(nonce), _b64(cifrado)))

    def descifrar(self, valor: str, contexto: str) -> bytes:
        aad = contexto.encode("utf-8")
        partes = valor.split(".")
        if len(partes) != 5 or partes[0] != PREFIJO:
            raise DescifradoError("Formato de dato cifrado desconocido")
        _, kid, dek_envuelta, nonce, cifrado = partes
        kek = self._claves.get(kid)
        if kek is None:
            raise DescifradoError(f"No hay clave '{kid}' para descifrar")
        try:
            envuelta = _desb64(dek_envuelta)
            dek = AESGCM(kek).decrypt(envuelta[:LONGITUD_NONCE], envuelta[LONGITUD_NONCE:], aad)
            return AESGCM(dek).decrypt(_desb64(nonce), _desb64(cifrado), aad)
        except (InvalidTag, binascii.Error, ValueError):
            raise DescifradoError("No se pudo descifrar: dato alterado o contexto distinto") from None

    def clave_de(self, valor: str) -> str | None:
        """Identificador de la clave que protege el valor, sin descifrarlo."""
        partes = valor.split(".")
        return partes[1] if len(partes) == 5 and partes[0] == PREFIJO else None

    def reenvolver(self, valor: str, contexto: str) -> str:
        """Vuelve a cifrar con la clave activa (rotación de claves)."""
        return self.cifrar(self.descifrar(valor, contexto), contexto)
