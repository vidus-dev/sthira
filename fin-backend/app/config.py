from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://finance:finance@localhost:5432/finance"
    secret_key: str = "change-me"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    service_name: str = "finance-api"
    metrics_enabled: bool = True
    otel_exporter_otlp_endpoint: str | None = None
    redis_url: str | None = None
    environment: Literal["development", "staging", "production"] = Field(
        default="development",
        description=(
            "In staging/production, SECRET_KEY must be at least 32 characters and cannot be "
            "the default placeholder 'change-me'."
        ),
    )

    @model_validator(mode="after")
    def validate_secret_key_strength(self) -> Self:
        if self.environment in ("staging", "production"):
            key = self.secret_key.strip()
            if key == "change-me":
                raise ValueError(
                    "SECRET_KEY cannot be the default placeholder 'change-me' when ENVIRONMENT is "
                    "staging or production."
                )
            if len(key) < 32:
                raise ValueError(
                    "SECRET_KEY must be at least 32 characters when ENVIRONMENT is staging or production."
                )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def session_cookie_https_only(self) -> bool:
        return self.environment in ("staging", "production")

    @property
    def session_same_site(self) -> Literal["lax", "strict"]:
        return "lax"

    @property
    def database_url_sync(self) -> str:
        """Alembic / sync tools: use psycopg3 (installed) instead of default psycopg2."""
        u = self.database_url
        if "+asyncpg" in u:
            return u.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
        return u


@lru_cache
def get_settings() -> Settings:
    return Settings()
