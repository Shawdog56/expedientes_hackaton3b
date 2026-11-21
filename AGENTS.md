# AGENTS.md

Punto de entrada para Codex y cualquier agente compatible con `AGENTS.md`.

Antes de hacer cualquier cosa, lee `.agents/AGENTS.md`: ahí están el mapa del
repositorio, las reglas duras y el protocolo para trabajar en paralelo con
Claude Code sin pisarse.

Resumen mínimo:

- El backlog es `.agents/feature_list.json` y solo se modifica con
  `pwsh .agents/scripts/claim.ps1` (usa `-Engine codex`).
- Una feature a la vez, en su propio worktree
  (`pwsh .agents/scripts/agent-worktree.ps1 -Action new -Id F-00X -Engine codex`).
- Roles en `.agents/agents/*.md`; skills en `.agents/skills/*/SKILL.md`.
- Para orquestar, sigue la skill `orchestrate`. Para lanzar trabajo en Claude,
  la skill `dispatch-claude`.
- Verifica dentro de Docker; nunca cierres una feature sin reportar comandos y
  resultados.
