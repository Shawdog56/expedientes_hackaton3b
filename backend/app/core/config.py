from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

MB = 1024 * 1024


class Settings(BaseSettings):
    app_name: str = "Expedientes API"
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:5173"]
    llm_api_key: str | None = None

    database_url: str = "postgresql+psycopg://expedientes:expedientes@db:5432/expedientes"

    # Almacenamiento de expedientes (volumen Docker)
    storage_dir: Path = Path("/data/expedientes")

    # Límites de validación
    max_pdf_mb: int = 50
    max_imagen_mb: int = 25
    # Por debajo del umbral de aviso de Pillow (~89 MP) para rechazar antes de que avise.
    max_imagen_pixeles: int = 80_000_000
    max_zip_mb: int = 300
    max_zip_descomprimido_mb: int = 1024
    max_archivos_zip: int = 1000
    max_ratio_compresion: int = 100

    # Seguridad de datos. Las claves nunca van en el repo: se generan con scripts/generar_claves.py.
    # Llavero de cifrado de campos: {"v1": "<32 bytes en base64>"}; se cifra con la activa.
    claves_cifrado: dict[str, str] = {}
    clave_cifrado_activa: str | None = None
    clave_indice: str | None = None  # HMAC de los índices ciegos (32 bytes en base64)
    pepper_password: str | None = None  # HMAC previo a Argon2id (32 bytes en base64)

    # Autenticación entre entidades con JWT firmado (RS256) y, opcionalmente, cifrado (JWE).
    auth_requerida: bool = False
    auth_audiencia: str = "expedientes-api"
    auth_claves_emisores_dir: Path | None = None  # <entidad>.pem con la clave pública de cada emisor
    auth_clave_cifrado_privada: Path | None = None  # clave privada RSA de la API para abrir JWE
    auth_exigir_cifrado: bool = False
    auth_ttl_maximo_seg: int = 900

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def max_pdf_bytes(self) -> int:
        return self.max_pdf_mb * MB

    @property
    def max_imagen_bytes(self) -> int:
        return self.max_imagen_mb * MB

    @property
    def max_zip_bytes(self) -> int:
        return self.max_zip_mb * MB

    @property
    def max_zip_descomprimido_bytes(self) -> int:
        return self.max_zip_descomprimido_mb * MB


settings = Settings()
