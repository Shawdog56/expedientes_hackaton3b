"""Cifrado de archivos grandes por bloques con AES-256-GCM (construcción de flujo).

Cada archivo usa su propia clave de datos (DEK), guardada envuelta con la clave maestra activa
mediante `Cifrador`. El contenido se cifra en bloques de 1 MiB, así que un PDF de 50 MB nunca
está entero en memoria.

Formato::

    magia (8) | largo de la DEK envuelta (4) | DEK envuelta | prefijo del nonce (4) | tamaño de bloque (4)
    bloque 0 | bloque 1 | ... | bloque final        (cada uno con su etiqueta de 16 bytes)

El nonce de cada bloque es `prefijo || número de bloque`. Los datos asociados de cada bloque
incluyen la cabecera completa y una marca de "último bloque", así que no se pueden reordenar,
quitar ni cortar bloques sin que falle la autenticación. El `contexto` (p. ej. el id del
documento) se autentica al envolver la DEK: un archivo copiado a otro documento no se abre.
"""

import os
import struct
from collections.abc import Iterator
from pathlib import Path

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.seguridad.errores import DescifradoError
from app.core.seguridad.proveedor import obtener_cifrador

MAGIA = b"3BENC1\x00\x00"
TAM_BLOQUE = 1024 * 1024
LONGITUD_ETIQUETA = 16
LONGITUD_PREFIJO = 4
EXTENSION = ".enc"


def esta_cifrado(ruta: Path) -> bool:
    """Indica si el archivo tiene el formato cifrado (los anteriores al cifrado están en claro)."""
    try:
        with open(ruta, "rb") as f:
            return f.read(len(MAGIA)) == MAGIA
    except OSError:
        return False


def _nonce(prefijo: bytes, indice: int) -> bytes:
    return prefijo + struct.pack(">Q", indice)


def _datos_asociados(cabecera: bytes, final: bool) -> bytes:
    return cabecera + (b"\x01" if final else b"\x00")


def _bloques(origen, tam: int) -> Iterator[tuple[bytes, bool]]:
    """Bloques del origen, marcando el último (se lee uno por adelantado)."""
    actual = origen.read(tam)
    while True:
        siguiente = origen.read(tam) if len(actual) == tam else b""
        yield actual, not siguiente
        if not siguiente:
            return
        actual = siguiente


def cifrar_archivo(origen: Path, destino: Path, contexto: str) -> None:
    """Cifra `origen` en `destino`. Si falla, no deja un archivo a medias."""
    dek = AESGCM.generate_key(bit_length=256)
    envuelta = obtener_cifrador().cifrar(dek, contexto).encode("ascii")
    prefijo = os.urandom(LONGITUD_PREFIJO)
    cabecera = MAGIA + struct.pack(">I", len(envuelta)) + envuelta + prefijo + struct.pack(">I", TAM_BLOQUE)
    aead = AESGCM(dek)

    destino.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(origen, "rb") as entrada, open(destino, "wb") as salida:
            salida.write(cabecera)
            for indice, (bloque, final) in enumerate(_bloques(entrada, TAM_BLOQUE)):
                salida.write(aead.encrypt(_nonce(prefijo, indice), bloque, _datos_asociados(cabecera, final)))
        os.chmod(destino, 0o600)
    except BaseException:
        destino.unlink(missing_ok=True)
        raise


def descifrar_flujo(ruta: Path, contexto: str) -> Iterator[bytes]:
    """Devuelve el contenido en claro por bloques. Lanza `DescifradoError` si el archivo no es auténtico."""
    with open(ruta, "rb") as f:
        if f.read(len(MAGIA)) != MAGIA:
            raise DescifradoError("El archivo no está cifrado")
        try:
            (largo,) = struct.unpack(">I", f.read(4))
            envuelta = f.read(largo)
            prefijo = f.read(LONGITUD_PREFIJO)
            (tam,) = struct.unpack(">I", f.read(4))
        except struct.error:
            raise DescifradoError("Cabecera del archivo cifrado incompleta") from None
        if len(envuelta) != largo or len(prefijo) != LONGITUD_PREFIJO or not 0 < tam <= 16 * TAM_BLOQUE:
            raise DescifradoError("Cabecera del archivo cifrado inválida")

        f.seek(0)
        cabecera = f.read(len(MAGIA) + 4 + largo + LONGITUD_PREFIJO + 4)
        dek = obtener_cifrador().descifrar(envuelta.decode("ascii", errors="replace"), contexto)
        aead = AESGCM(dek)

        indice = 0
        for bloque, final in _bloques(f, tam + LONGITUD_ETIQUETA):
            try:
                yield aead.decrypt(_nonce(prefijo, indice), bloque, _datos_asociados(cabecera, final))
            except InvalidTag:
                raise DescifradoError("No se pudo descifrar el archivo: está alterado o incompleto") from None
            indice += 1


def descifrar_a_archivo(ruta: Path, destino: Path, contexto: str) -> None:
    """Escribe el contenido en claro en `destino` (con permisos solo para el propietario)."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    try:
        descriptor = os.open(destino, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(descriptor, "wb") as salida:
            for bloque in descifrar_flujo(ruta, contexto):
                salida.write(bloque)
    except BaseException:
        destino.unlink(missing_ok=True)
        raise
