"""Hace cumplir el desacoplamiento entre capas analizando los imports de `app/`.

Si esta prueba falla, una capa está importando algo que no le corresponde. Corrige el
import o, si el cambio es deliberado, actualiza CAPAS y `.agents/rules/backend.md`.
"""

import ast
from pathlib import Path

APP = Path(__file__).resolve().parent.parent / "app"

# capa -> capas de `app` que puede importar (además de sí misma)
CAPAS: dict[str, set[str]] = {
    "app.domain": set(),
    "app.core": set(),
    "app.agents": {"app.domain"},
    "app.db": {"app.domain", "app.core"},
    "app.services": {"app.domain", "app.core", "app.db"},
    "app.schemas": {"app.domain"},
    "app.api": {
        "app.domain",
        "app.core",
        "app.db",
        "app.services",
        "app.schemas",
        "app.agents",
    },
}

# Dentro de app.agents, un agente concreto solo puede usar la infraestructura común.
INFRA_AGENTES = {"app.agents.base", "app.agents.contratos"}
MODULOS_INFRA_AGENTES = {"app.agents.base", "app.agents.contratos", "app.agents.registry"}


def _capa(modulo: str) -> str | None:
    for capa in CAPAS:
        if modulo == capa or modulo.startswith(capa + "."):
            return capa
    return None


def _modulo_de(archivo: Path) -> str:
    partes = archivo.relative_to(APP.parent).with_suffix("").parts
    if partes[-1] == "__init__":
        partes = partes[:-1]
    return ".".join(partes)


def _imports(archivo: Path) -> list[str]:
    arbol = ast.parse(archivo.read_text(encoding="utf-8"))
    encontrados: list[str] = []
    for nodo in ast.walk(arbol):
        if isinstance(nodo, ast.Import):
            encontrados += [a.name for a in nodo.names if a.name.split(".")[0] == "app"]
        elif isinstance(nodo, ast.ImportFrom) and nodo.module and nodo.level == 0:
            if nodo.module.split(".")[0] == "app":
                encontrados.append(nodo.module)
    return encontrados


def _archivos():
    return [(a, _modulo_de(a)) for a in sorted(APP.rglob("*.py"))]


def test_las_capas_respetan_sus_dependencias():
    violaciones = []
    for archivo, modulo in _archivos():
        capa = _capa(modulo)
        if capa is None:  # app.main y similares: punto de ensamblaje, pueden importar todo
            continue
        permitidas = CAPAS[capa] | {capa}
        for destino in _imports(archivo):
            capa_destino = _capa(destino)
            if capa_destino is not None and capa_destino not in permitidas:
                violaciones.append(f"{modulo} no puede importar {destino} ({capa} -> {capa_destino})")
    assert not violaciones, "\n".join(violaciones)


def test_un_agente_no_importa_a_otro_agente():
    violaciones = []
    for archivo, modulo in _archivos():
        if not modulo.startswith("app.agents.") or modulo in MODULOS_INFRA_AGENTES:
            continue
        for destino in _imports(archivo):
            if destino.startswith("app.agents") and destino not in INFRA_AGENTES:
                violaciones.append(f"{modulo} importa {destino}; usa solo base y contratos")
    assert not violaciones, "\n".join(violaciones)
