---
name: dispatch-claude
description: Lanza un implementador, revisor o explorador de Claude Code sobre un worktree de expedientes_hackaton3b, ya sea como subagente (si el orquestador es Claude) o como proceso claude -p (si el orquestador es Codex).
---

# Despachar trabajo a Claude

## Detección

```powershell
Get-Command claude -ErrorAction SilentlyContinue
```

- Orquestador = Claude → usa la herramienta `Agent` (modo 1).
- Orquestador = Codex y existe `claude` → usa el CLI (modo 2).
- Sin CLI → modo manual (modo 3).

## Modo 1: subagente desde una sesión de Claude

Lanza el subagente `implementer` (definido en `.claude/agents/`) con el brief de
`.agents/templates/brief.md` como prompt. Para varias features, lanza todos los
subagentes en un mismo mensaje para que corran en paralelo, y en segundo plano
si la sesión lo permite.

El subagente arranca en el directorio de la sesión, no en el worktree. Por eso
el brief debe indicar la ruta absoluta del worktree y exigir que todas las
ediciones y comandos se hagan ahí (`git -C <worktree> ...`, rutas absolutas).
Como alternativa, usa `isolation: "worktree"` del propio Agent y registra la
ruta que devuelva con `claim.ps1 -Action set -Id <id> -Status in_progress -Note "worktree <ruta>"`.

## Modo 2: proceso `claude -p` desde Codex

```powershell
$wt     = "<ruta absoluta del worktree>"
$main   = (git rev-parse --show-toplevel)
$report = "$main/.agents/runs/F-001/implementer-claude.md"
New-Item -ItemType Directory -Force (Split-Path $report) | Out-Null
$brief  = Get-Content -Raw "$main/.agents/runs/F-001/brief-claude.md"

Push-Location $wt
claude -p $brief `
  --permission-mode acceptEdits `
  --allowedTools "Read,Edit,Write,Glob,Grep,Bash" `
  --add-dir $main `
  --output-format text | Out-File -Encoding utf8 "$main/.agents/runs/F-001/stdout-claude.txt"
Pop-Location
```

- `--add-dir $main` le permite escribir el reporte y el tablero en el checkout
  principal.
- Lanza cada feature en segundo plano (`Start-Job` o una terminal aparte) para
  que corran en paralelo.
- Comprueba los flags con `claude --help` antes del primer uso; si cambiaron,
  ajusta este archivo.

## Modo 3: manual

1. Guarda el brief en `.agents/runs/<id>/brief-claude.md`.
2. Pide al usuario que abra Claude Code sobre la carpeta del worktree y pegue el
   brief (o que escriba: "Sigue `.agents/runs/<id>/brief-claude.md`").
3. Espera a que la feature pase a `review` o `blocked` en el tablero.

## Revisor y explorador

Mismo procedimiento, cambiando el rol del brief a `reviewer` o `explorer`. El
revisor trabaja en solo lectura: en el modo 2 usa
`--permission-mode default --allowedTools "Read,Glob,Grep,Bash"`.
