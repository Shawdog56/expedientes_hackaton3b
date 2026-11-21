---
name: orchestrate
description: Orquesta features de expedientes_hackaton3b en paralelo entre Claude y Codex. Úsala cuando haya que avanzar el backlog de .agents/feature_list.json con varios agentes a la vez, repartir trabajo por motor o integrar ramas de agentes.
---

# Orquestar Claude + Codex

Bucle completo del orquestador. Funciona igual si el orquestador es Claude o
Codex; solo cambia qué skill de despacho es "local" y cuál es "remota".

## 0. Modos de trabajo

| Modo | Cuándo | Cómo |
|---|---|---|
| **A. Un orquestador, dos motores** | El CLI del otro motor está instalado | El orquestador lanza a Claude y a Codex desde la terminal (`dispatch-claude`, `dispatch-codex`) |
| **B. Dos sesiones pares** | Claude y Codex abiertos como apps, sin CLI | Cada sesión reclama sus propias features con `claim-feature`; el tablero y los candados evitan choques |
| **C. Manual asistido** | Solo un motor puede ejecutar comandos | El orquestador prepara el brief del otro motor y el usuario lo pega en la app abierta sobre el worktree |

Detecta el modo con la sección "Detección" de cada skill de despacho. Si hay
duda, usa B: es el más robusto.

## 1. Preparar

```powershell
pwsh .agents/scripts/claim.ps1 -Action list
git status --short
```

- Si hay cambios sin confirmar fuera de `.agents/` y `.claude/`, los
  worktrees no los verán. Pide al usuario que los confirme o trabaja sin
  worktrees solo en features cuyos `files` no se solapen con esos cambios.
- Si el tablero quedó bloqueado por una sesión caída, libéralo solo si el
  usuario confirma que no hay otra sesión escribiendo: `claim.ps1 -Action unlock`.
- Features en `in_progress` de una sesión que ya no existe: devuélvelas con
  `claim.ps1 -Action set -Id <id> -Status pending -Note "sesión caída"`.

## 2. Planificar la oleada

1. `claim.ps1 -Action ready` lista las features listas (dependencias en
   `done`, sin conflicto de archivos).
2. Si una feature no tiene `files` claros, lanza un `explorer` antes.
3. Reparte por motor respetando `engine`. Con `any`, alterna Claude/Codex.
4. Presenta al usuario la tabla de la oleada (feature, motor, archivos) antes de
   lanzar si es la primera oleada de la sesión.

## 3. Despachar

Por cada feature de la oleada, en este orden:

```powershell
pwsh .agents/scripts/claim.ps1 -Action claim -Id F-001 -Engine codex
pwsh .agents/scripts/agent-worktree.ps1 -Action new -Id F-001 -Engine codex
```

Rellena `.agents/templates/brief.md` y lánzalo con `dispatch-claude` o
`dispatch-codex`. En Claude, lanza los subagentes en un solo mensaje para que
corran en paralelo. Los procesos de Codex lánzalos en segundo plano.

## 4. Recoger

Cada implementador deja `.agents/runs/<id>/implementer-<motor>.md` en el
checkout principal y pasa la feature a `review` o `blocked`. Espera a que todas
las features de la oleada lleguen a uno de esos estados; no hagas polling
agresivo (revisa cada pocos minutos o cuando el proceso termine).

## 5. Revisión cruzada

Skill `cross-review`. El revisor es siempre el motor contrario al
implementador.

## 6. Integrar

Con `APPROVED`, en el checkout principal (skill `worktree`, "Integrar"):

```powershell
git merge --no-ff agent/codex/F-001-agente_escrituras
docker compose run --rm --no-deps backend pytest -q
pwsh .agents/scripts/claim.ps1 -Action set -Id F-001 -Status done -Note "merge <sha>; revisado por claude"
pwsh .agents/scripts/agent-worktree.ps1 -Action remove -Id F-001 -Engine codex
```

Integra una rama a la vez y corre la verificación tras cada merge. Si algo
falla después del merge, revierte ese merge y devuelve la feature a
`in_progress` con la nota del fallo.

Confirma el tablero junto con la integración:
`git add .agents/feature_list.json && git commit -m "chore(agents): cerrar F-001"`.

## 7. Repetir

Vuelve al paso 2 hasta que no queden features listas. Termina con el reporte
final descrito en `.agents/agents/orchestrator.md`.

## Límites

- Máximo 2 features por motor por oleada.
- Máximo 2 rondas de `CHANGES_REQUESTED` por feature; luego `blocked`.
- Nunca dos features en vuelo con `files` solapados.
