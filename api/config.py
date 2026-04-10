from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    db_url: str
    secret_key: str

    model_config = SettingsConfigDict(
        env_file="/Users/Work/data-practice/fieldhands/.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
