# <id> - <rol> (<motor>)

- Resultado: <done | blocked | APPROVED | CHANGES_REQUESTED>
- Rama / commit: agent/<motor>/<id>-<nombre> @ <sha corto>
- Fecha: <AAAA-MM-DD HH:MM>

## Cambios

- `<archivo>`: <qué cambió y por qué, una línea>

## Verificación

| Comando | Resultado |
|---|---|
| `docker compose -p ... run --rm --no-deps backend pytest -q` | <n passed / fallo concreto> |

## Contrato y dependencias

<Campos, endpoints o tipos que otras features deben conocer. "Sin cambios" si no aplica.>

## Hallazgos (solo revisores)

| Severidad | Archivo:línea | Escenario de fallo |
|---|---|---|

## Riesgos y pendientes

- <lo que no se pudo verificar y por qué>
