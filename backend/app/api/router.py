from fastapi import APIRouter, Depends

from app.api.routes import agents, expedientes, health
from app.api.seguridad import requiere_entidad

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(agents.router, dependencies=[Depends(requiere_entidad)])
api_router.include_router(expedientes.router, dependencies=[Depends(requiere_entidad)])
