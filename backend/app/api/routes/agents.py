from fastapi import APIRouter, HTTPException

from app.agents.registry import get_agent, list_agents
from app.schemas.agents import AgentInfo, AgentRunRequest, AgentRunResponse

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=list[AgentInfo])
async def agents() -> list[AgentInfo]:
    return [AgentInfo(name=a.name, description=a.description) for a in list_agents()]


@router.post("/{name}/run", response_model=AgentRunResponse)
async def run_agent(name: str, body: AgentRunRequest) -> AgentRunResponse:
    agent = get_agent(name)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agente '{name}' no existe")
    result = await agent.run(body.input, body.context)
    return AgentRunResponse(agent=name, result=result)
