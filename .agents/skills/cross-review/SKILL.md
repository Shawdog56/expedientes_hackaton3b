---
name: cross-review
description: Revisión cruzada entre motores en expedientes_hackaton3b. Lo que implementa Claude lo revisa Codex y viceversa. Úsala cuando una feature pase a estado review.
---

# Revisión cruzada

## Regla

| Implementó | Revisa |
|---|---|
| `claude` | `codex` |
| `codex` | `claude` |

Si el motor contrario no está disponible, revisa una instancia nueva del mismo
motor (sin el contexto del implementador) y anótalo en el tablero.

## Pasos

1. Confirma que la feature está en `review` y que existe
   `.agents/runs/<id>/implementer-<motor>.md`.
2. Rellena `.agents/templates/brief.md` con rol `reviewer`, la rama, el worktree
   y la ruta del reporte del implementador.
3. Despacha con `dispatch-claude` o `dispatch-codex` según toque.
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
