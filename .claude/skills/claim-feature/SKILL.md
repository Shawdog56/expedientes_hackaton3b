---
name: claim-feature
description: Reclama, actualiza o libera features del tablero compartido .agents/feature_list.json de forma segura cuando Claude y Codex trabajan a la vez. Úsala antes de empezar una feature y al terminarla.
---

# Reclamar features del tablero

El tablero es compartido por sesiones de Claude y de Codex que pueden correr al
mismo tiempo. Nunca edites `.agents/feature_list.json` a mano: usa el script,
que serializa las escrituras con candados atómicos (`mkdir`) en
`.agents/locks/` del checkout principal, aunque lo ejecutes desde un worktree.

## Comandos

```powershell
# Ver el tablero
pwsh .agents/scripts/claim.ps1 -Action list

# Features listas para tomar (dependencias en done y sin conflicto de archivos)
pwsh .agents/scripts/claim.ps1 -Action ready

# Reclamar
pwsh .agents/scripts/claim.ps1 -Action claim -Id F-002 -Engine codex

# Cambiar estado (review, done, blocked, pending)
pwsh .agents/scripts/claim.ps1 -Action set -Id F-002 -Status review -Note "pytest 18/18"

# Liberar el candado del tablero si quedó huérfano (solo con confirmación del usuario;
# además se libera solo pasados 2 minutos)
pwsh .agents/scripts/claim.ps1 -Action unlock
```

## Reglas del reclamo

El script rechaza el reclamo si:

- la feature no está en `pending`;
- alguna `depends_on` no está en `done`;
- algún archivo de `files` se solapa con otra feature en `in_progress` o
  `review`;
- el `engine` de la feature no es `any` ni coincide con el tuyo.

Si te rechaza, no fuerces: elige otra feature o informa al orquestador.

## Ciclo de estados

```text
pending -> in_progress -> review -> done
                 \           \
                  -> blocked  -> in_progress (CHANGES_REQUESTED)
```

- `set -Status pending` libera la feature y borra `owner`, `branch` y
  `worktree`.
- Las notas se acumulan en `notes` con fecha y motor.

## Modo de dos sesiones pares

Si Claude y Codex trabajan como sesiones independientes (sin orquestador
único), cada uno:

1. Ejecuta `-Action ready` y reclama una feature con su `-Engine`.
2. Crea su worktree y trabaja como `implementer`.
3. Al pasar a `review`, avisa al usuario para que la otra sesión la revise con
   la skill `cross-review`.
4. Solo una de las dos sesiones, la que el usuario designe, integra en `main`.
