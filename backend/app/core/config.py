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
    max_zip_mb: int = 300
    max_zip_descomprimido_mb: int = 1024
    max_archivos_zip: int = 1000
    max_ratio_compresion: int = 100

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def max_pdf_bytes(self) -> int:
        return self.max_pdf_mb * MB

    @property
    def max_zip_bytes(self) -> int:
        return self.max_zip_mb * MB

    @property
    def max_zip_descomprimido_bytes(self) -> int:
        return self.max_zip_descomprimido_mb * MB


settings = Settings()
