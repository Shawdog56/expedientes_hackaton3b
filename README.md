# expedientes_hackaton3b

Todo corre en Docker; no hace falta Python ni Node en la máquina.

## Estructura

```
backend/    API FastAPI para los agentes (Python 3.12)
  app/
    main.py           app + CORS
    core/config.py    settings (.env)
    api/routes/       endpoints (/api/health, /api/agents, /api/expedientes, /api/documentos)
    db/               SQLAlchemy: sesión y modelos
    services/         validacion.py (PDF, JPG, PNG y ZIP), clasificacion.py (tipo documental), expedientes.py
    domain/           enums y constantes compartidas (no importa nada de app)
    agents/           agentes (base.py, contratos.py, registry.py autodescubierto, echo.py de ejemplo)
    schemas/          modelos Pydantic
  alembic/            migraciones de la BD
  tests/              pytest
frontend/   React + Vite (Node 22), proxy /api -> backend:8000
docs/       base-de-datos.md (modelo de datos y flujo), seguridad.md (cifrado y tokens)
docker-compose.yml   db (PostgreSQL 17) + backend + frontend
```

## Levantar

Con Docker Desktop abierto, desde la raíz del repositorio:

```powershell
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

El script comprueba Docker, crea `backend/.env` con claves de cifrado nuevas si no existen, descarga las imágenes, instala las dependencias de backend y frontend, levanta todos los contenedores, descarga el modelo de lenguaje (unos 2 GB la primera vez) y espera a que todo responda. Se puede repetir sin riesgo.

| Opción | Para qué |
|---|---|
| `.\run.ps1 -Logs` | Ver los registros en vivo |
| `.\run.ps1 -Detener` | Detener todo (los datos se conservan) |
| `.\run.ps1 -Reconstruir` | Reconstruir las imágenes sin caché tras cambiar dependencias |
| `.\run.ps1 -SinEsperarModelo` | No esperar a que termine la descarga del modelo |

Cada persona genera sus propias claves en su `backend/.env`. Guarda una copia: sin ellas no se pueden leer los expedientes cifrados de tu entorno.

A mano, sin el script:

```powershell
copy backend\.env.example backend\.env
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:8000/api/health
- Docs: http://localhost:8000/docs
- PostgreSQL: localhost:5432 (usuario/clave/BD: `expedientes`)

Las migraciones se aplican solas al arrancar el backend. El código se monta como volumen: los cambios recargan solos (uvicorn `--reload` y Vite HMR).

### Modelo de lenguaje (Ollama)

El modelo (`qwen2.5:3b`) corre en **un contenedor**, `ollama`. El servicio `ollama-pull` lo descarga en su volumen la primera vez (unos 2 GB) y después se reutiliza.

- La instancia atiende una petición a la vez y mantiene el modelo cargado (cuenta con **unos 3 a 4 GB de RAM**). Si llegan varias, por ejemplo los documentos de un lote, el backend las encola y las procesa en orden.
- El contenedor no publica puertos: la API de Ollama no tiene autenticación y solo la usa el backend.
- **Para procesar más documentos a la vez**, agrega en `docker-compose.yml` otro servicio igual a `ollama` (por ejemplo `ollama-2`, con el mismo volumen y `OLLAMA_NOPRUNE: "1"` en ambos para que no se borren las descargas entre sí) y lista las dos URL en `OLLAMA_BASE_URLS`. El backend ya reparte las peticiones entre todas las instancias que encuentre ahí.

## Dependencias

```powershell
# Python: editar backend/requirements.txt y reconstruir
docker compose up --build backend

# Node: instalar dentro del contenedor y reconstruir
docker compose run --rm frontend npm install <paquete>
docker compose up --build -V frontend
```

Si cambias `package.json`, usa siempre `-V`: renueva el volumen de `node_modules`; si no lo haces, el contenedor sigue usando las dependencias viejas.

## Flujo

```
carga + validación ─► clasificación ─► agentes especialistas ─► orquestador (validación cruzada) ─► verificación
       (hecho)            (hecho)           (pendiente)                 (pendiente)                  (pendiente)
```

### 1. Carga y validación

`POST /api/expedientes` (multipart): campos `archivos` (PDF, JPG, PNG o un `.zip`), `rutas` (ruta relativa de cada archivo, mismo orden) y `nombre`.

- **PDF**: se valida la firma `%PDF`, que pypdf lo pueda abrir, que no tenga contraseña y que tenga páginas.
- **Imagen (`.jpg`, `.jpeg`, `.png`)**: se valida la firma real del archivo (no solo la extensión), que Pillow la abra sin errores y que no supere `MAX_IMAGEN_MB` (25) ni `MAX_IMAGEN_PIXELES` (80 millones). Cuenta como 1 página y su `formato` queda en la respuesta (`pdf`, `jpeg` o `png`) para que los agentes sepan si leer texto o usar visión.
- **ZIP**: se detecta por extensión o firma y se descomprime solo con los documentos válidos (PDF, JPG y PNG). Se protege contra zip-slip (`../`), zip bombs (tamaño total, número de archivos y ratio de compresión) y se ignoran `__MACOSX`/`.DS_Store`. Los ZIP anidados, los miembros cifrados y los no-PDF se rechazan.
- Respuesta `201` con `documentos` y `rechazados` (con `motivo`); `422` si no hubo ningún documento válido.
- Límites configurables en `backend/.env` (ver `.env.example`).

### 2. Clasificación por nombre de archivo

Cada documento se clasifica en uno de los 4 tipos documentales según su nombre, sin importar mayúsculas, acentos, prefijos numéricos ni texto extra ([clasificacion.py](backend/app/services/clasificacion.py)):

| Tipo | El nombre contiene | Agente |
|---|---|---|
| Escrituras | `escritur…` | `agente_escrituras` |
| Predial | `predial…` | `agente_predial` |
| Alineamiento y Número Oficial | `alinea…` o `número oficial` | `agente_alineamiento` |
| Uso de Suelo | `uso de suelo` / `uso suelo` | `agente_uso_suelo` |

- Si el nombre no coincide, se usa la carpeta que lo contiene (p. ej. `Predial/recibo.pdf`).
- Sin coincidencia → `sin_clasificar`; varias → `ambiguo`. Ninguno de los dos se envía a un agente hasta asignarle tipo a mano: `PATCH /api/documentos/{id}` `{"tipo_documental": "predial"}` (en la UI, con el selector de cada documento).
- La respuesta incluye `tipos_faltantes`, `tipos_duplicados` y `completo`.
- `GET /api/tipos-documentales` lista los tipos con su agente.

Otros endpoints: `GET /api/expedientes`, `GET /api/expedientes/{id}`, `DELETE /api/expedientes/{id}`.

### 3. Visor de archivos y decisión final

- `GET /api/documentos/{id}/archivo` devuelve el archivo original (PDF, JPG o PNG) para verlo en línea. El tipo de contenido sale del formato validado al subirlo y solo se sirven archivos del volumen de expedientes. En el panel B se abre en un visor lateral desde cada documento de la lista y desde cada tarjeta del análisis, y permite pasar de un archivo a otro del expediente.
- `PUT /api/expedientes/{id}/decision` con `{"decision": "aceptado" | "rechazado"}` registra la decisión de la persona que revisa (`decision_final`, `decidido_en` y, con autenticación activa, `decidido_por`). La última decisión reemplaza a la anterior y no cambia `estado`, que lo mueven los agentes.
- En la interfaz, la pestaña **Decisión final** se habilita solo después de abrir **Zona y competencia**. Si el dictamen del análisis no es "cumple", aceptar pide una confirmación.

Para los agentes: `documentos_para_agentes(db, expediente_id)` agrupa por agente los documentos pendientes.

### Base de datos

Ver [docs/base-de-datos.md](docs/base-de-datos.md): diagrama, decisiones y cómo escribirán los agentes y el orquestador.

### Seguridad

Los archivos de los expedientes (en el volumen, con nombre aleatorio) y los datos sensibles de la base (nombres, rutas y resultados) van cifrados con AES-256-GCM, y la API puede exigir tokens JWT firmados con RSA entre entidades. **Sin claves de cifrado no se pueden subir expedientes**: genéralas antes de empezar, como explica [docs/seguridad.md](docs/seguridad.md). Si tienes archivos subidos antes del cifrado, ejecuta `docker compose exec backend python scripts/cifrar_archivos_existentes.py`.

```powershell
docker compose run --rm --no-deps backend python scripts/generar_claves.py servidor
```

Pega las líneas que muestra en `backend/.env`.

## Pruebas

```powershell
docker compose exec backend pytest -q
```

## Agregar un agente

1. Crear `backend/app/agents/mi_agente.py` con una clase que herede de `BaseAgent`
   (agentes genéricos) o de `AgenteExtractor` (especialistas por tipo documental; ver
   `app/agents/contratos.py`).
2. Nada más: el registro descubre solo cualquier agente de `app/agents/`. Los
   genéricos quedan en `POST /api/agents/mi_agente/run`; los extractores se ejecutan
   sobre los documentos de un expediente.

Un agente solo puede importar `app.domain`, `app.agents.base` y `app.agents.contratos`;
`tests/test_arquitectura.py` lo comprueba.
