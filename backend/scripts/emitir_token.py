"""Emite un token JWT (RS256) de una entidad para llamar a la API.

    docker compose run --rm --no-deps backend python scripts/emitir_token.py \\
        --entidad hospital --clave-privada secretos/hospital_privada.pem \\
        [--clave-publica-api secretos/api_cifrado_publica.pem]

Con `--clave-publica-api` el token sale cifrado (JWE). Se usa como `Authorization: Bearer <token>`.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.seguridad.tokens import TTL_POR_DEFECTO, emitir_token  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--entidad", required=True)
    parser.add_argument("--clave-privada", type=Path, required=True)
    parser.add_argument("--clave-publica-api", type=Path)
    parser.add_argument("--audiencia", default="expedientes-api")
    parser.add_argument("--ttl", type=int, default=TTL_POR_DEFECTO, help="segundos de vigencia")
    args = parser.parse_args()
    destino = args.clave_publica_api.read_bytes() if args.clave_publica_api else None
    print(
        emitir_token(
            emisor=args.entidad,
            audiencia=args.audiencia,
            clave_privada_pem=args.clave_privada.read_bytes(),
            ttl=args.ttl,
            clave_publica_destino_pem=destino,
        )
    )


if __name__ == "__main__":
    main()
