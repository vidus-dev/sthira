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
