from fastapi import APIRouter

from app.api.routes import agents, expedientes, health

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(agents.router)
api_router.include_router(expedientes.router)
