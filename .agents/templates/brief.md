# Brief para <rol> (<motor>) - <id>

Actúa según `.agents/agents/<rol>.md` y lee `.agents/AGENTS.md` antes de empezar.

- Feature: <id> - <título>
- Módulo: <backend | frontend | repo-root>
- Regla: `.agents/rules/<modulo>.md`
- Motor: <claude | codex>
- Worktree (trabaja SOLO aquí, rutas absolutas): <ruta absoluta del worktree>
- Rama: agent/<motor>/<id>-<nombre>
- Checkout principal (tablero y reportes): <ruta absoluta del checkout principal>
- Archivos permitidos (`files`):
  - <archivo 1>
  - <archivo 2>
- Resultado esperado:
  - <deliverable 1>
  - <deliverable 2>
- Verificación obligatoria:
  - `docker compose -p exp-<motor>-<id> run --rm --no-deps <servicio> <comando>`
- Contrato con otras features: <qué consume o expone; "ninguno" si no aplica>
- Reporte: escribe `<checkout principal>/.agents/runs/<id>/<rol>-<motor>.md`
  siguiendo `.agents/templates/handoff.md`.
- Tablero: al terminar, `pwsh <checkout principal>/.agents/scripts/claim.ps1 -Action set -Id <id> -Status <review|blocked> -Note "<resumen>"`.

Para revisores, añade:

- Implementador: <motor> - reporte en `<ruta del reporte del implementador>`
- Diff: `git -C <worktree> diff main...agent/<motor>/<id>-<nombre>`
- Riesgos prioritarios: regresión funcional, contrato API, tipos, secretos.
