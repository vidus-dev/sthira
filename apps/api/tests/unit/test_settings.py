"""Settings validation (no DB — safe for CI)."""

import os
from unittest.mock import patch

import pytest
from app.config import Settings, get_settings


@pytest.fixture(autouse=True)
def clear_settings_cache() -> None:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_development_allows_short_secret() -> None:
    with patch.dict(
        os.environ,
        {"ENVIRONMENT": "development", "SECRET_KEY": "short"},
        clear=False,
    ):
        s = Settings()
        assert s.environment == "development"
        assert s.secret_key == "short"


def test_staging_rejects_short_secret() -> None:
    with patch.dict(
        os.environ,
        {"ENVIRONMENT": "staging", "SECRET_KEY": "short"},
        clear=False,
    ):
        with pytest.raises(ValueError, match="32"):
            Settings()


def test_staging_rejects_default_placeholder_secret() -> None:
    with patch.dict(
        os.environ,
        {"ENVIRONMENT": "staging", "SECRET_KEY": "change-me"},
        clear=False,
    ):
        with pytest.raises(ValueError, match="placeholder"):
            Settings()


def test_staging_accepts_long_random_secret() -> None:
    long_key = "x" * 32
    with patch.dict(
        os.environ,
        {"ENVIRONMENT": "staging", "SECRET_KEY": long_key},
        clear=False,
    ):
        s = Settings()
        assert s.secret_key == long_key


@pytest.mark.parametrize(
    ("async_url", "sync_url"),
    [
        (
            "postgresql+asyncpg://u:p@localhost:5432/db",
            "postgresql+psycopg://u:p@localhost:5432/db",
        ),
        (
            "postgresql+asyncpg://u:p@ep-x.aws.neon.tech/neondb?ssl=require",
            "postgresql+psycopg://u:p@ep-x.aws.neon.tech/neondb?sslmode=require",
        ),
        (
            "postgresql+asyncpg://u:p@h/db?application_name=sthira&ssl=require",
            "postgresql+psycopg://u:p@h/db?application_name=sthira&sslmode=require",
        ),
    ],
)
def test_sync_url_for_migrations(async_url: str, sync_url: str) -> None:
    with patch.dict(os.environ, {"DATABASE_URL": async_url}, clear=False):
        assert Settings().database_url_sync == sync_url
