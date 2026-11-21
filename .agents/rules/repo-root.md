# Reglas del módulo: repo-root

- Cubre `docker-compose.yml`, `README.md`, `.gitignore`, `AGENTS.md`,
  `CLAUDE.md`, `.agents/` y `.claude/`.
- No mezcles aquí lógica de backend o frontend.
- Si cambias `docker-compose.yml`:
  - valida con `docker compose config -q`;
  - no fijes valores que dependan de una sola máquina;
  - documenta puertos y volúmenes nuevos en `README.md`.
- Si cambias `.agents/`, regenera el espejo con
  `pwsh .agents/scripts/sync-agents.ps1` y comprueba con `-Check`.
- Si cambias documentación, aplica la skill `documenter`.
- Variables de entorno nuevas: indica dónde viven y qué servicio las consume.
