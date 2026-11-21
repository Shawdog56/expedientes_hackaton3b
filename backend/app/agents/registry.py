"""Registro de agentes con autodescubrimiento.

Cualquier módulo de `app/agents/` que defina una subclase concreta de `BaseAgent` queda
registrado solo; no hay que editar este archivo al añadir un agente. Un módulo roto no
tumba al resto: su error se guarda y se puede consultar con `errores_de_carga()`.
"""

import importlib
import inspect
import logging
import pkgutil

import app.agents as paquete
from app.agents.base import BaseAgent
from app.agents.contratos import AgenteExtractor
from app.domain.documentos import AGENTE_POR_TIPO, TipoDocumental

logger = logging.getLogger(__name__)

_MODULOS_INFRA = {"base", "contratos", "registry"}

_agentes: dict[str, BaseAgent] | None = None
_errores: dict[str, str] = {}


def _validar(agente: BaseAgent) -> None:
    if isinstance(agente, AgenteExtractor):
        tipo = getattr(agente, "tipo_documental", None)
        if tipo is None:
            raise ValueError(f"{type(agente).__name__} no define tipo_documental")
        esperado = AGENTE_POR_TIPO[tipo]
        if agente.name != esperado:
            raise ValueError(f"{type(agente).__name__}.name debe ser '{esperado}' (es '{agente.name}')")


def _descubrir() -> dict[str, BaseAgent]:
    agentes: dict[str, BaseAgent] = {}
    _errores.clear()
    for info in pkgutil.iter_modules(paquete.__path__):
        if info.name in _MODULOS_INFRA:
            continue
        modulo_nombre = f"{paquete.__name__}.{info.name}"
        try:
            modulo = importlib.import_module(modulo_nombre)
            for _, clase in inspect.getmembers(modulo, inspect.isclass):
                if (
                    issubclass(clase, BaseAgent)
                    and clase.__module__ == modulo_nombre
                    and not inspect.isabstract(clase)
                ):
                    agente = clase()
                    _validar(agente)
                    if agente.name in agentes:
                        raise ValueError(f"Nombre de agente duplicado: '{agente.name}'")
                    agentes[agente.name] = agente
        except Exception as e:  # noqa: BLE001 - aislar fallos de un agente del resto
            logger.exception("No se pudo cargar el agente %s", modulo_nombre)
            _errores[modulo_nombre] = f"{type(e).__name__}: {e}"
    return agentes


def _todos() -> dict[str, BaseAgent]:
    global _agentes
    if _agentes is None:
        _agentes = _descubrir()
    return _agentes


def recargar() -> None:
    """Fuerza un nuevo descubrimiento (útil en pruebas)."""
    global _agentes
    _agentes = None


def get_agent(name: str) -> BaseAgent | None:
    return _todos().get(name)


def list_agents() -> list[BaseAgent]:
    return list(_todos().values())


def agente_para_tipo(tipo: TipoDocumental) -> AgenteExtractor | None:
    agente = get_agent(AGENTE_POR_TIPO[tipo])
    return agente if isinstance(agente, AgenteExtractor) else None


def errores_de_carga() -> dict[str, str]:
    _todos()
    return dict(_errores)
