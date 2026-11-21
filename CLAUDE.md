# CLAUDE.md

@.agents/AGENTS.md

## Notas específicas de Claude Code

- Los subagentes viven en `.claude/agents/` y las skills en `.claude/skills/`.
  Ambos son un espejo generado de `.agents/`: edita siempre `.agents/` y luego
  ejecuta `pwsh .agents/scripts/sync-agents.ps1`.
- Usa `-Engine claude` en `claim.ps1` y `agent-worktree.ps1`.
- Los subagentes de Claude no pueden lanzar otros subagentes: el orquestador
  debe ser la sesión principal (`claude --agent orchestrator` o pedir a la
  sesión que siga la skill `orchestrate`).
- Codex es opcional: el flujo completo funciona solo con Claude. Solo si el
  usuario lo pide, delega trabajo en Codex con la skill `dispatch-codex`.
