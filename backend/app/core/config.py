from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Expedientes API"
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:5173"]
    llm_api_key: str | None = None
    ollama_base_url: str = "http://ollama:11434"
    ollama_model: str = "qwen2.5:3b"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
