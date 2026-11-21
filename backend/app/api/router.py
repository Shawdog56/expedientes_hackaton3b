from fastapi import APIRouter

from app.api.routes import agents, health

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(agents.router)
