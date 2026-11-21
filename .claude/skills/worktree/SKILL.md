---
name: worktree
description: Crea, lista, integra y elimina worktrees de git aislados por feature y motor (Claude o Codex) en expedientes_hackaton3b, y verifica cada uno en Docker sin chocar con el stack principal.
---

# Worktrees por feature

Cada implementador trabaja en su propio worktree para que Claude y Codex puedan
editar en paralelo sin pisarse.

- Ruta: `../expedientes_hackaton3b-wt/<motor>-<id>`
- Rama: `agent/<motor>/<id>-<nombre>` desde `main`

## Crear

```powershell
pwsh .agents/scripts/agent-worktree.ps1 -Action new -Id F-001 -Engine claude
```

El script se niega si el checkout principal tiene cambios sin confirmar fuera de
`.agents/` y `.claude/`, porque el worktree nacería sin ellos. Usa
`-AllowDirty` solo si los cambios no afectan a la feature.

El script registra `branch` y `worktree` en el tablero.

## Listar y eliminar

```powershell
pwsh .agents/scripts/agent-worktree.ps1 -Action list
pwsh .agents/scripts/agent-worktree.ps1 -Action remove -Id F-001 -Engine claude
```

`remove` elimina el worktree, pero conserva la rama si no está integrada en
`main` (añade `-DeleteBranch` para borrarla igualmente).

## Verificar dentro de un worktree

El proyecto de Compose toma el nombre de la carpeta, pero usa siempre `-p` para
que el aislamiento sea explícito. `run --no-deps` no publica puertos, así que no
choca con el stack principal en 5173/8000/5432:

```powershell
docker compose -p exp-claude-f-001 run --rm --no-deps backend pytest -q
docker compose -p exp-claude-f-001 run --rm --no-deps frontend npm run lint
docker compose -p exp-claude-f-001 run --rm --no-deps frontend npm run build
```

La primera ejecución construye la imagen del proyecto; las siguientes la
reutilizan. Limpia al terminar con `docker compose -p exp-claude-f-001 down --rmi local -v`.

## Integrar (solo el orquestador)

Desde el checkout principal, en `main`:

```powershell
git fetch . agent/claude/F-001-agente_escrituras
git merge --no-ff agent/claude/F-001-agente_escrituras -m "chore(agents): integrar F-001 agente_escrituras"
docker compose run --rm --no-deps backend pytest -q
```

Si hay conflicto, aborta (`git merge --abort`) y devuelve la feature al
implementador dueño con los archivos en conflicto. No resuelvas conflictos de
código desde el orquestador.
