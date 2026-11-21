# Seguridad de los datos

Cómo se protegen los datos sensibles de los expedientes: en la base de datos, en las contraseñas y en la comunicación entre entidades. El código vive en [`backend/app/core/seguridad/`](../backend/app/core/seguridad/).

## Qué se usa para cada dato

| Dato | Técnica | Dónde |
|---|---|---|
| Contraseñas | **Argon2id** con pepper opcional | `passwords.py` |
| Datos que hay que leer después (características extraídas, evidencia, mensajes y resúmenes de la validación) | **AES-256-GCM** con cifrado por sobre | `cifrado.py`, `db/tipos.py` |
| Datos que se buscan por igualdad | **HMAC-SHA256** (índice ciego) junto al dato cifrado | `indices.py` |
| Identidad entre entidades | **JWT firmado con RSA (RS256)** | `tokens.py`, `api/seguridad.py` |
| Contenido del token, si debe ir confidencial | **JWE** (RSA-OAEP-256 + A256GCM), firmado primero y cifrado después | `tokens.py` |
| Tránsito | **TLS 1.3**, y mTLS entre entidades | despliegue (ver más abajo) |
| Archivos del expediente (PDF, JPG, PNG) | **AES-256-GCM por bloques**, un archivo cifrado con nombre aleatorio | `archivos.py`, `services/expedientes.py` |
| Disco o volumen completo | cifrado de disco (BitLocker, LUKS o el de la nube) | despliegue |

Un JWT firmado **no cifra**: cualquiera puede leer su contenido. Por eso el token solo lleva identidad (`iss`, `sub`, `aud`, `exp`) y los datos sensibles se piden a la API por un canal TLS.

## Campos cifrados en la base de datos

| Tabla | Columna | Tipo en la base |
|---|---|---|
| `extracciones` | `caracteristicas` | texto cifrado |
| `hallazgos` | `evidencia` | texto cifrado |
| `hallazgos` | `mensaje` | texto cifrado |
| `validaciones_cruzadas` | `resumen` | texto cifrado |
| `expedientes` | `nombre` | texto cifrado |
| `documentos` | `nombre` | texto cifrado |
| `documentos` | `ruta` | texto cifrado |
| `archivos_rechazados` | `ruta` | texto cifrado |

En la base solo se ve `enc1.<clave>.<sobre>.<nonce>.<cifrado>`. El modelo SQLAlchemy cifra y descifra solo (`JSONCifrado` y `TextoCifrado`).

- **Cifrado por sobre.** Cada valor usa una clave de datos aleatoria, que se guarda envuelta con la clave maestra activa. El identificador de la clave maestra viaja en el valor.
- **Contexto.** El nombre de la columna se autentica junto con el dato: un valor copiado a otra columna no se puede descifrar.
- **Consecuencia.** Ya no se puede consultar `caracteristicas` con operadores JSONB. Si hace falta buscar por un campo, guárdalo también como índice ciego (`indice_ciego(valor, "extracciones.folio")`) en una columna con `index=True` y busca por ese índice.
- **Orden.** Como `documentos.ruta` está cifrada, la API ordena los documentos en Python, no con SQL.
- **No se cifra** el `sha256` de cada documento: sirve para detectar el mismo archivo subido dos veces. Quien ya tenga un archivo puede comprobar si está en el sistema, pero no puede leer nada nuevo.

## Archivos del expediente

Los PDF e imágenes se guardan en `STORAGE_DIR/<expediente>/documentos/<id>.enc`, cifrados y con un nombre aleatorio: ni el nombre ni las carpetas originales aparecen en el disco.

- **Formato.** AES-256-GCM por bloques de 1 MiB, así que un archivo de 50 MB nunca está entero en memoria. Cada archivo usa su propia clave de datos, envuelta con la clave maestra activa. Reordenar, quitar o cortar bloques, alterar un bit o copiar el archivo a otro documento hace que el descifrado falle.
- **Al subir.** Los archivos se validan en un directorio temporal **fuera del volumen** (`/tmp` del contenedor), se cifran al volumen y el temporal se borra siempre, incluso si la carga falla. Sin claves configuradas la carga responde `503` y no deja nada en disco. Para que ese temporal no toque el disco, monta `/tmp` como `tmpfs` en el despliegue; cuesta memoria con zips grandes.
- **Al leer.** El visor (`GET /api/documentos/{id}/archivo`) descifra por bloques sin escribir nada en disco. Si el archivo está alterado responde `500` en lugar de entregar datos.
- **Para los agentes.** `documento_en_claro(documento)`, en `services/expedientes.py`, entrega una **ruta temporal** con una copia en claro que se borra al salir del bloque. El agente sigue recibiendo una ruta y su formato, y no toca las claves.
- **Archivos anteriores al cifrado.** Se siguen leyendo, pero quedan en claro hasta que ejecutes:

```powershell
docker compose exec backend python scripts/cifrar_archivos_existentes.py
```

El script los cifra, actualiza la ruta, borra el original y las carpetas vacías. Se puede repetir sin riesgo.

**Límites.** El archivo en claro existe en memoria o en el temporal mientras se valida, se visualiza o lo procesa un agente. Y si un agente envía el contenido a un proveedor de LLM externo, esa copia sale del sistema: el cifrado en reposo no la protege (ver el contrato con el proveedor).

## Claves

Nunca van al repositorio. Se generan con:

```powershell
docker compose run --rm --no-deps backend python scripts/generar_claves.py servidor
```

El comando crea `backend/secretos/` (ignorado por Git y por Docker) y muestra las variables para `backend/.env`:

| Variable | Uso |
|---|---|
| `CLAVES_CIFRADO` | Llavero JSON `{"v1": "<32 bytes en base64>"}` |
| `CLAVE_CIFRADO_ACTIVA` | Clave con la que se cifra lo nuevo |
| `CLAVE_INDICE` | Clave del HMAC de los índices ciegos |
| `PEPPER_PASSWORD` | Clave del HMAC previo a Argon2id |

Si faltan, escribir un campo sensible falla con un mensaje claro; no se guarda nada en claro.

**En producción** guarda las claves en un gestor (Vault, Azure Key Vault, AWS KMS u otro) y entrégalas como variables de entorno. Haz copia de seguridad de ellas **aparte** de la base de datos: sin la clave, los datos cifrados no se pueden recuperar.

### Rotación

1. Genera una clave nueva y agrégala al llavero: `{"v1": "...", "v2": "..."}`.
2. Cambia `CLAVE_CIFRADO_ACTIVA` a `v2` y reinicia. Lo nuevo se cifra con `v2`; lo viejo sigue legible con `v1`.
3. Para retirar `v1`, recorre las filas y llama a `obtener_cifrador().reenvolver(valor, contexto)`; después quita `v1` del llavero.

### Si se filtra una clave

1. Genera una clave nueva y haz la rotación completa, reenvolviendo todas las filas.
2. Elimina la clave filtrada del llavero.
3. Si se filtró una clave de firma de una entidad, borra su `.pem` de `AUTH_CLAVES_EMISORES_DIR` y registra el par nuevo.

## Autenticación entre entidades

Está **apagada por defecto** (`AUTH_REQUERIDA=false`) para no romper el frontend, que aún no tiene inicio de sesión. Al activarla, `/api/agents` y `/api/expedientes` exigen `Authorization: Bearer <token>`; `/api/health` sigue abierto.

### Alta de una entidad

```powershell
docker compose run --rm --no-deps backend python scripts/generar_claves.py entidad hospital
```

La clave **privada** (`secretos/hospital_privada.pem`) se entrega a la entidad por un canal seguro. La **pública** queda en `secretos/entidades/hospital.pem`; el nombre del archivo es el identificador del emisor.

### Emitir un token

```powershell
docker compose run --rm --no-deps backend python scripts/emitir_token.py --entidad hospital --clave-privada secretos/hospital_privada.pem
```

Con `--clave-publica-api secretos/api_cifrado_publica.pem` el token sale cifrado (JWE). Para que la API acepte solo tokens cifrados, define `AUTH_EXIGIR_CIFRADO=true`.

### Qué valida la API

- Solo `RS256`; rechaza `alg: none` y cualquier otro algoritmo.
- El emisor (`kid`) debe tener su clave pública registrada y coincidir con `iss`.
- `aud` igual a `AUTH_AUDIENCIA` (por defecto `expedientes-api`), y `exp`, `iat` y `jti` presentes.
- Vigencia máxima de `AUTH_TTL_MAXIMO_SEG` (900 s) y 30 s de holgura de reloj.
- Los errores de token responden `401` sin detalle; una configuración rota responde `503`.

**Limitación conocida:** no se guarda el `jti`, así que un token robado se puede reutilizar hasta que expire. Se compensa con vidas cortas; si hace falta revocar, habrá que añadir una lista de `jti` (por ejemplo en Redis).

## TLS y mTLS

La API habla HTTP plano dentro de Docker. En producción debe ir detrás de TLS 1.3:

- **Proxy inverso** (Nginx, Traefik, Caddy) que termine TLS y, si las entidades son servicios, exija certificado de cliente (mTLS).
- O bien `uvicorn --ssl-keyfile ... --ssl-certfile ... --ssl-ca-certs ... --ssl-cert-reqs 2`.

Los certificados dependen de tu infraestructura; no se incluyen en el repositorio.

## Pruebas

```powershell
docker compose exec backend pytest -q tests/test_seguridad_datos.py tests/test_tokens_y_auth.py
```

Cubren cifrado, rotación, contexto cruzado, datos alterados, índices, Argon2id, tokens firmados y cifrados, rechazo de `alg: none` y de tokens expirados, y la API con y sin autenticación.
