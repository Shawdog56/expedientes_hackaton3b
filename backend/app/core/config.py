from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Expedientes API"
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:5173"]
    llm_api_key: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
