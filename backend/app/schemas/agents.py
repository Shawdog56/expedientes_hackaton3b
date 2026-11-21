from typing import Any

from pydantic import BaseModel


class AgentInfo(BaseModel):
    name: str
    description: str


class AgentRunRequest(BaseModel):
    input: str
    context: dict[str, Any] | None = None


class AgentRunResponse(BaseModel):
    agent: str
    result: dict[str, Any]
