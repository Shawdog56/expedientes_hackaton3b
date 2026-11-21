from app.agents.base import BaseAgent
from app.agents.clasificador import ClasificadorAgent
from app.agents.echo import EchoAgent
from app.agents.validador_cruzado import ValidadorCruzadoAgent

_AGENTS: dict[str, BaseAgent] = {
    a.name: a
    for a in [
        EchoAgent(),
        ClasificadorAgent(),
        ValidadorCruzadoAgent(),
    ]
}


def get_agent(name: str) -> BaseAgent | None:
    return _AGENTS.get(name)


def list_agents() -> list[BaseAgent]:
    return list(_AGENTS.values())
