# AGENTS.md

Punto de entrada para Codex y cualquier agente compatible con `AGENTS.md`.

Antes de hacer cualquier cosa, lee `.agents/AGENTS.md`: ahí están el mapa del
repositorio, las reglas duras y el protocolo para trabajar sin pisarse con otros
agentes. Trabajar con Codex es opcional: el proyecto funciona solo con Claude
Code, así que este archivo solo aplica si el usuario te puso a trabajar aquí.

Resumen mínimo:

- El backlog es `.agents/feature_list.json` y solo se modifica con
  `pwsh .agents/scripts/claim.ps1` (usa `-Engine codex`).
- Una feature a la vez. Si hay otro agente trabajando en paralelo, usa tu propio
  worktree
  (`pwsh .agents/scripts/agent-worktree.ps1 -Action new -Id F-00X -Engine codex`).
- Roles en `.agents/agents/*.md`; skills en `.agents/skills/*/SKILL.md`.
- Para orquestar, sigue la skill `orchestrate`. Para lanzar trabajo en Claude,
  la skill `dispatch-claude`.
- Verifica dentro de Docker; nunca cierres una feature sin reportar comandos y
  resultados.
