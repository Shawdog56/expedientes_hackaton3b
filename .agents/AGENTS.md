# AGENTS.md - Mapa operativo para agentes (Claude y Codex)

Fuente única de verdad para cualquier agente que trabaje en
`expedientes_hackaton3b`, sea Claude Code o Codex. Los archivos `AGENTS.md` y
`CLAUDE.md` de la raíz solo apuntan aquí.

## 1. Arranque obligatorio

1. Lee `.agents/feature_list.json`. Toma solo la feature que te asignaron o una
   `pending` cuyas dependencias estén en `done`.
2. Reclama la feature con el script (nunca editando el JSON a mano):
   `pwsh .agents/scripts/claim.ps1 -Action claim -Id F-00X -Engine <claude|codex>`.
   Si el script la rechaza (ya reclamada, dependencias abiertas o archivos en
   conflicto), no la tomes.
3. Confirma el módulo afectado (`backend`, `frontend` o `repo-root`) y lee
   `.agents/rules/<modulo>.md`.
4. Lee el `README.md` raíz y, si tocas el frontend, `frontend/README.md`.
5. Ejecuta `git status --short` antes de editar. No toques cambios ajenos.

## 2. Mapa del repositorio

| Ruta | Rol |
|---|---|
| `README.md` | Cómo levantar el sistema y contrato de `/api/expedientes` |
| `docker-compose.yml` | `db` (Postgres 17), `backend` (FastAPI) y `frontend` (Vite) |
| `backend/app/api/routes/` | Endpoints `/api/health`, `/api/agents`, `/api/expedientes` |
| `backend/app/agents/` | Agentes de dominio (`BaseAgent`, `registry.py`) |
| `backend/app/services/` | Validación, clasificación y almacenamiento de expedientes |
| `backend/app/db/`, `backend/alembic/` | Modelos SQLAlchemy y migraciones |
| `backend/tests/` | Pytest (SQLite en memoria, sin Postgres) |
| `frontend/src/` | React 19 + Vite + TypeScript + Tailwind |
| `.agents/` | Backlog, roles, reglas, skills y scripts de orquestación |
| `.claude/` | Espejo generado de `.agents/` para Claude Code (no editar a mano) |

## 3. Modelo de orquestación Claude + Codex

- **Un solo escritor del tablero.** `.agents/feature_list.json` solo se modifica
  con `.agents/scripts/claim.ps1`, que usa candados atómicos en
  `.agents/locks/` del checkout principal. Funciona igual desde un worktree.
- **Un worktree por feature y motor.** Cada implementador trabaja en
  `../expedientes_hackaton3b-wt/<motor>-<id>` sobre la rama
  `agent/<motor>/<id>-<nombre>`. Se crea con `.agents/scripts/agent-worktree.ps1`.
- **Propiedad de archivos.** Cada feature declara `files`. Dos features en
  `in_progress` no pueden compartir archivos; el script lo impide.
- **Revisión cruzada.** Lo que implementa Claude lo revisa Codex y al revés
  (skill `cross-review`). Si solo hay un motor disponible, revisa una instancia
  limpia del mismo motor.
- **Integración solo por el orquestador.** Los implementadores nunca hacen merge
  a `main` ni confirman cambios en `.agents/feature_list.json`.

Roles en `.agents/agents/`: `orchestrator`, `implementer`, `reviewer`,
`explorer`. Skills en `.agents/skills/<nombre>/SKILL.md`.

## 4. Reglas duras

- Una feature por agente a la vez.
- No inventes rutas, servicios ni dependencias que no existan en el repo.
- Todo corre en Docker; no asumas Python ni Node instalados en el host.
- No declares `done` sin registrar los comandos de verificación y su resultado.
- No dejes `print`, `console.log`, secretos, archivos temporales ni comentarios
  de relleno.
- Comentarios y documentación en español. Respeta la convención existente: el
  dominio usa identificadores en español (`TipoDocumental`, `documentos_para_agentes`).
- Si cambias un contrato de la API, actualiza en la misma feature
  `backend/app/schemas/` y `frontend/src/types/` o deja una feature dependiente.

## 5. Verificación por módulo

Desde la raíz del checkout o del worktree. En un worktree usa `-p` para aislar
el proyecto de Compose y no chocar con el stack principal:

```powershell
# backend
docker compose -p exp-<motor>-<id> run --rm --no-deps backend pytest -q
# frontend
docker compose -p exp-<motor>-<id> run --rm --no-deps frontend npm run lint
docker compose -p exp-<motor>-<id> run --rm --no-deps frontend npm run build
```

En el checkout principal con el stack levantado también sirve
`docker compose exec backend pytest -q`.

## 6. Si te bloqueas

- Busca primero patrones existentes en el módulo.
- Si depende de infraestructura (Docker, red, CLI ausente), documenta el comando
  exacto que falló y márcala con
  `claim.ps1 -Action set -Id F-00X -Status blocked -Note "<motivo>"`.
- Si la tarea cruza backend y frontend, divídela por frontera técnica antes de
  editar.
