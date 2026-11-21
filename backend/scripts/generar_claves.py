"""Genera las claves de seguridad. Nada de esto debe versionarse.

Uso (desde la raíz del repositorio):

    docker compose run --rm --no-deps backend python scripts/generar_claves.py servidor
    docker compose run --rm --no-deps backend python scripts/generar_claves.py entidad <nombre>

`servidor` crea las claves de datos y el par RSA con el que la API abre tokens cifrados, y
muestra las líneas para `backend/.env`. `entidad` crea el par RSA con el que una entidad firma:
la privada se entrega a esa entidad y la pública queda en `secretos/entidades/<nombre>.pem`.
"""

import argparse
import base64
import json
import os
import secrets
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

SECRETOS = Path(__file__).resolve().parent.parent / "secretos"


def _b64(n: int = 32) -> str:
    return base64.b64encode(secrets.token_bytes(n)).decode("ascii")


def _escribir(ruta: Path, contenido: bytes, privado: bool) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    if ruta.exists():
        raise SystemExit(f"{ruta} ya existe; bórralo a mano si quieres regenerarlo")
    ruta.write_bytes(contenido)
    os.chmod(ruta, 0o600 if privado else 0o644)


def _par_rsa(privada: Path, publica: Path) -> None:
    clave = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    _escribir(
        privada,
        clave.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ),
        privado=True,
    )
    _escribir(
        publica,
        clave.public_key().public_bytes(
            serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
        ),
        privado=False,
    )


def servidor() -> None:
    _par_rsa(SECRETOS / "api_cifrado_privada.pem", SECRETOS / "api_cifrado_publica.pem")
    (SECRETOS / "entidades").mkdir(parents=True, exist_ok=True)
    print("# Pega estas líneas en backend/.env (no las subas al repositorio)")
    print(f"CLAVES_CIFRADO='{json.dumps({'v1': _b64()})}'")
    print("CLAVE_CIFRADO_ACTIVA=v1")
    print(f"CLAVE_INDICE={_b64()}")
    print(f"PEPPER_PASSWORD={_b64()}")
    print("# Autenticación entre entidades (rutas dentro del contenedor)")
    print("AUTH_REQUERIDA=true")
    print("AUTH_CLAVES_EMISORES_DIR=/app/secretos/entidades")
    print("AUTH_CLAVE_CIFRADO_PRIVADA=/app/secretos/api_cifrado_privada.pem")
    print("# AUTH_EXIGIR_CIFRADO=true")


def entidad(nombre: str) -> None:
    if not nombre.replace("-", "").replace("_", "").isalnum():
        raise SystemExit("El nombre solo puede tener letras, números, guion y guion bajo")
    _par_rsa(SECRETOS / f"{nombre}_privada.pem", SECRETOS / "entidades" / f"{nombre}.pem")
    print(f"Clave privada de '{nombre}': {SECRETOS / (nombre + '_privada.pem')}")
    print(f"Clave pública registrada: {SECRETOS / 'entidades' / (nombre + '.pem')}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="orden", required=True)
    sub.add_parser("servidor")
    sub.add_parser("entidad").add_argument("nombre")
    args = parser.parse_args()
    servidor() if args.orden == "servidor" else entidad(args.nombre)


if __name__ == "__main__":
    main()
