# Reglas del módulo: frontend

- Stack: React 19, Vite, TypeScript, Tailwind v4, `lucide-react`. Lint con
  `oxlint`.
- Estructura: `api/` (llamadas HTTP), `types/` (contratos), `components/`
  (UI), `utils/` (funciones puras), `styles/`.
- Las llamadas van a `/api/...`; Vite las redirige al backend. No fijes
  `localhost:8000` en el código.
- Los tipos de `src/types/` reflejan `backend/app/schemas/`. Si el backend
  cambia un contrato, actualiza aquí o deja la feature bloqueada.
- Nada de `any` si el dato se puede modelar.
- Dependencias nuevas: `docker compose run --rm frontend npm install <paquete>`
  y luego reconstruir con `-V`.
- Verifica con:
  - `docker compose -p <proyecto> run --rm --no-deps frontend npm run lint`
  - `docker compose -p <proyecto> run --rm --no-deps frontend npm run build`
