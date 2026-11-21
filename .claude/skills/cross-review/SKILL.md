---
name: cross-review
description: Revisión independiente en expedientes_hackaton3b. Quien revisa no es quien implementó: con Codex, el motor contrario; sin Codex, una instancia limpia de Claude. Úsala cuando una feature pase a estado review.
---

# Revisión independiente

## Regla

Sin Codex (lo habitual), revisa una **instancia nueva de Claude**: el subagente
`reviewer`, sin el contexto del implementador. Solo ve el diff, el reporte y la
verificación que ejecute por su cuenta. Anótalo en el tablero con
`claim.ps1 -Action set -Id <id> -Status review -Note "revisión por Claude (instancia limpia, sin Codex)"`.

Si el usuario usa Codex, cruzan los motores:

| Implementó | Revisa |
|---|---|
| `claude` | `codex` |
| `codex` | `claude` |

## Pasos

1. Confirma que la feature está en `review` y que existe
   `.agents/runs/<id>/implementer-<motor>.md`.
2. Rellena `.agents/templates/brief.md` con rol `reviewer`, la rama, el worktree
   y la ruta del reporte del implementador.
3. Despacha con `dispatch-claude` (o `dispatch-codex` si toca el otro motor).
4. Lee `.agents/runs/<id>/review-<motor-revisor>.md`.

## Resultado

- `APPROVED` → el orquestador integra (skill `worktree`, "Integrar").
- `CHANGES_REQUESTED` →
  1. `claim.ps1 -Action set -Id <id> -Status in_progress -Note "ronda <n>: <resumen>"`.
  2. Reenvía los hallazgos al implementador original en el mismo worktree.
  3. Tras dos rondas sin aprobación, `-Status blocked` y escala al usuario.

## Desacuerdos

Si el implementador rechaza un hallazgo, no decide el orquestador por su
cuenta: presenta ambas posturas al usuario con archivo, línea y escenario.
