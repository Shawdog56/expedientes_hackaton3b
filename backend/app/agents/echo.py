from typing import Any

from app.agents.base import BaseAgent


class EchoAgent(BaseAgent):
    """Agente de ejemplo: devuelve la entrada. Sustituir por agentes reales."""

    name = "echo"
    description = "Agente de prueba que repite la entrada"

    async def run(self, input: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        return {"output": input, "context": context or {}}
