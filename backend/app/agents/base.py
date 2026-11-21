from abc import ABC, abstractmethod
from typing import Any


class BaseAgent(ABC):
    """Contrato común para todos los agentes."""

    name: str = "base"
    description: str = ""

    @abstractmethod
    async def run(self, input: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        ...
