"""Prueba aislada del ClasificadorAgent.

Uso (desde la carpeta backend/):
    python test_clasificador.py "texto a clasificar"
    python test_clasificador.py -f ruta/al/archivo.txt
    echo "texto" | python test_clasificador.py
    python test_clasificador.py            # modo interactivo
"""
import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.agents.clasificador import ClasificadorAgent  # noqa: E402


def leer_entrada(args: argparse.Namespace) -> str:
    if args.file:
        return Path(args.file).read_text(encoding="utf-8")
    if args.texto:
        return " ".join(args.texto)
    if not sys.stdin.isatty():
        return sys.stdin.read()
    print("Pega el texto y termina con una línea vacía + Ctrl+Z/Enter (Windows) o Ctrl+D:")
    return sys.stdin.read()


async def main() -> None:
    parser = argparse.ArgumentParser(description="Probar ClasificadorAgent")
    parser.add_argument("texto", nargs="*", help="Texto de entrada")
    parser.add_argument("-f", "--file", help="Archivo de texto con la entrada")
    args = parser.parse_args()

    texto = leer_entrada(args).strip()
    if not texto:
        sys.exit("Error: no se recibió texto de entrada.")

    agente = ClasificadorAgent()
    inicio = time.perf_counter()
    resultado = await agente.run(texto)
    duracion = time.perf_counter() - inicio

    print(json.dumps(resultado, ensure_ascii=False, indent=2))
    print(f"\n⏱  {duracion:.2f}s")


if __name__ == "__main__":
    asyncio.run(main())
