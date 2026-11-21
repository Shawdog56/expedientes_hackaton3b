---
name: commit
description: Estándar de mensajes de commit de expedientes_hackaton3b (Conventional Commits con descripción en español) para Claude y Codex, incluidas las ramas de agentes.
---

# Commits

## Formato

```text
tipo(scope): descripción corta en español
```

El `tipo` y el `scope` se mantienen tal cual están en las tablas (en inglés,
como pide Conventional Commits); solo la descripción va en español.

## Tipos

| Tipo | Uso |
|---|---|
| `feat` | Funcionalidad nueva |
| `fix` | Corrección de errores |
| `refactor` | Reestructura sin cambio de comportamiento |
| `docs` | Solo documentación |
| `test` | Pruebas |
| `chore` | Herramientas, scripts, configuración |
| `style` | Formato o estilos visuales sin lógica |
| `perf` | Rendimiento |
| `build` | Dependencias o imágenes Docker |

## Scopes

| Scope | Uso |
|---|---|
| `backend` | `backend/` en general |
| `agents-api` | `backend/app/agents/` |
| `db` | `backend/app/db/` y `backend/alembic/` |
| `frontend` | `frontend/` |
| `agents` | `.agents/`, `.claude/`, `AGENTS.md`, `CLAUDE.md` |
| `infra` | `docker-compose.yml`, `.gitignore`, raíz |

## Reglas

1. Descripción en español, en infinitivo o presente ("agregar", "corrige"),
   con tildes y ñ correctas y sin punto final.
2. Un cambio lógico por commit.
3. Describe qué cambió, no cómo.
4. En ramas `agent/*`, añade al cuerpo la línea `Feature: <id>`.
5. Nunca incluyas `.agents/feature_list.json` en commits de ramas de agentes.
6. Añade la línea de coautoría que indique tu herramienta (Claude o Codex) si
   la configuración del usuario la exige.

## Ejemplos

```text
feat(agents-api): agregar agente de extracción de escrituras

Feature: F-001
```

```text
chore(agents): cerrar F-001 tras la revisión cruzada
```
