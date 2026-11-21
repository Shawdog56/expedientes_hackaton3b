# expedientes_hackaton3b

Todo corre en Docker; no hace falta Python ni Node en la máquina.

## Estructura

```
backend/    API FastAPI para los agentes (Python 3.12)
  app/
    main.py           app + CORS
    core/config.py    settings (.env)
    api/routes/       endpoints (/api/health, /api/agents)
    agents/           agentes (base.py, registry.py, echo.py de ejemplo)
    schemas/          modelos Pydantic
frontend/   React + Vite (Node 22), proxy /api -> backend:8000
docker-compose.yml
```

## Levantar

```powershell
copy backend\.env.example backend\.env   # opcional
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:8000/api/health
- Docs: http://localhost:8000/docs

El código se monta como volumen: los cambios recargan solos (uvicorn `--reload` y Vite HMR).

## Dependencias

```powershell
# Python: editar backend/requirements.txt y reconstruir
docker compose up --build backend

# Node: instalar dentro del contenedor y reconstruir
docker compose run --rm frontend npm install <paquete>
docker compose up --build -V frontend
```

## Agregar un agente

1. Crear `backend/app/agents/mi_agente.py` heredando de `BaseAgent`.
2. Registrarlo en `backend/app/agents/registry.py`.
3. Queda disponible en `POST /api/agents/mi_agente/run`.
