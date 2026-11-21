# Reglas del módulo: backend

- Stack: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, pypdf.
  Postgres 17 en Compose; las pruebas usan SQLite en memoria (`tests/conftest.py`).

## Capas y dependencias (obligatorio)

Cada capa solo puede importar las que aparecen a su derecha. Lo comprueba
`backend/tests/test_arquitectura.py`; si falla, corrige el import, no la prueba.

| Capa | Puede importar |
|---|---|
| `app.domain` | nada de `app` |
| `app.core` | nada de `app` |
| `app.agents` | `app.domain` |
| `app.db` | `app.domain`, `app.core` |
| `app.services` | `app.domain`, `app.core`, `app.db` |
| `app.schemas` | `app.domain` |
| `app.api` | todas las anteriores |

- Enums y constantes que usen varias capas van en `app/domain/`, nunca en una
  capa concreta. `services/clasificacion.py` y `db/models.py` reexportan los
  nombres antiguos solo por compatibilidad: en código nuevo importa de
  `app.domain`.
- Rutas (`api/routes/`) sin lógica de negocio: delegan en `services/`.

## Agentes

- Un agente es un archivo en `backend/app/agents/`. **No se edita `registry.py`**:
  el registro descubre solo cualquier subclase concreta de `BaseAgent`.
- Los especialistas heredan de `AgenteExtractor` (`agents/contratos.py`), definen
  `name` (debe ser `AGENTE_POR_TIPO[tipo]` de `app/domain/documentos.py`),
  `tipo_documental` y `async extraer(solicitud) -> ResultadoExtraccion`.
- Un agente solo importa `app.domain`, `app.agents.base` y
  `app.agents.contratos`. No toca la base de datos, no usa la API ni importa a
  otro agente: recibe la ruta del archivo (PDF o imagen) y su `formato`, y devuelve características.
- Los fallos de un agente se lanzan como excepción; quien orquesta los registra.
- Los documentos pendientes de un expediente, agrupados por agente, salen de
  `services.expedientes.documentos_para_agentes(db, id)`; lo llama el servicio de
  extracción, nunca el agente.
- Los archivos del volumen están **cifrados**: `Documento.ruta_almacenamiento` apunta al
  archivo cifrado, no se puede leer directo. El servicio de extracción abre cada documento con
  `services.expedientes.documento_en_claro(documento)` (copia temporal que se borra al salir) y
  pasa esa ruta al agente en `SolicitudExtraccion.ruta_archivo`. El agente no toca las claves.

## Datos y configuración

- Si cambias modelos, agrega una migración en `backend/alembic/versions/`.
- Variables nuevas: en `core/config.py` y en `backend/.env.example`. Nunca
  secretos reales en el repo (`llm_api_key` va en `.env`).
- Dependencias nuevas en `requirements.txt`; requieren reconstruir la imagen.
- Pruebas sin red ni Postgres. Mockea cualquier llamada a un LLM externo.
- Verifica con:
  `docker compose -p <proyecto> run --rm --no-deps backend pytest -q`.
