---
name: dispatch-codex
description: Opcional. Lanza un implementador, revisor o explorador de Codex sobre un worktree de expedientes_hackaton3b con codex exec (si el CLI está disponible) o mediante un brief para la app de Codex. Úsala solo si el usuario pidió trabajar con Codex.
---

# Despachar trabajo a Codex

> **Opcional.** El proyecto funciona solo con Claude. Usa esta skill únicamente
> si el usuario pidió trabajar con Codex; si no, ignórala y usa `dispatch-claude`.

## Detección

```powershell
Get-Command codex -ErrorAction SilentlyContinue
```

- Existe `codex` → modo 1 (CLI no interactivo).
- Solo está la app de escritorio de Codex → modo 2 (manual).
- Instalar el CLI: `npm i -g @openai/codex` (pedir permiso al usuario antes).

## Modo 1: `codex exec`

```powershell
$wt     = "<ruta absoluta del worktree>"
$main   = (git rev-parse --show-toplevel)
$runDir = "$main/.agents/runs/F-002"
New-Item -ItemType Directory -Force $runDir | Out-Null
$brief  = Get-Content -Raw "$runDir/brief-codex.md"

codex exec `
  --cd $wt `
  --sandbox workspace-write `
  --add-dir $main `
  --output-last-message "$runDir/last-message-codex.md" `
  $brief
```

- `--cd` fija el worktree como raíz de trabajo.
- `--sandbox workspace-write` permite editar el worktree; `--add-dir $main`
  le deja escribir reporte y tablero en el checkout principal.
- Docker necesita salir del sandbox. Si `docker compose` falla por permisos,
  repite con `--sandbox danger-full-access` solo con permiso explícito del
  usuario, o deja que el orquestador ejecute la verificación.
- Para paralelo, lanza cada feature en segundo plano (`Start-Job` o una
  terminal aparte) y espera a que termine el proceso.
- Comprueba los flags con `codex exec --help` antes del primer uso; si
  cambiaron, ajusta este archivo.

## Modo 2: app de Codex (manual)

1. Guarda el brief en `.agents/runs/<id>/brief-codex.md`.
2. Pide al usuario que abra en Codex la carpeta del worktree y escriba:
   "Lee AGENTS.md y sigue `.agents/runs/<id>/brief-codex.md`". Ojo: dentro del
   worktree la carpeta `.agents/runs/` no existe; da la ruta absoluta del
   checkout principal.
3. Espera a que la feature pase a `review` o `blocked` en el tablero.

## Revisor y explorador

Mismo procedimiento con el rol `reviewer` o `explorer` en el brief. Para el
revisor usa `--sandbox read-only` salvo que deba ejecutar la verificación en
Docker.

## Skills dentro de Codex

Codex lee `AGENTS.md` de la raíz y las skills de `.agents/skills/`. No hace
falta copiar nada: basta con que el brief nombre el rol
(`.agents/agents/implementer.md`).
