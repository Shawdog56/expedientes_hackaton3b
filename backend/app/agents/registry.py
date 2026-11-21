from app.agents.base import BaseAgent
from app.agents.echo import EchoAgent

_AGENTS: dict[str, BaseAgent] = {a.name: a for a in [EchoAgent()]}


def get_agent(name: str) -> BaseAgent | None:
    return _AGENTS.get(name)


def list_agents() -> list[BaseAgent]:
    return list(_AGENTS.values())
