"""Tests for SecurityHeadersMiddleware."""

import pytest
from app.config import get_settings
from app.factory import create_app
from starlette.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    get_settings.cache_clear()
    return TestClient(create_app(enable_auth=False))


def test_core_security_headers_present(client: TestClient) -> None:
    resp = client.get("/v1/health/live")
    h = resp.headers
    assert h["X-Content-Type-Options"] == "nosniff"
    assert h["X-Frame-Options"] == "DENY"
    assert h["Referrer-Policy"] == "no-referrer"
    assert "Permissions-Policy" in h
    assert h["Cross-Origin-Opener-Policy"] == "same-origin"


def test_strict_csp_on_api_responses(client: TestClient) -> None:
    resp = client.get("/v1/health/live")
    assert resp.headers["Content-Security-Policy"] == (
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    )


def test_csp_skipped_for_docs(client: TestClient) -> None:
    # Swagger UI must not get the strict CSP or it cannot load.
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    assert "Content-Security-Policy" not in resp.headers


def test_hsts_only_over_https(client: TestClient) -> None:
    # TestClient default base_url is http -> no HSTS.
    resp = client.get("/v1/health/live")
    assert "Strict-Transport-Security" not in resp.headers


def test_hsts_present_over_https() -> None:
    get_settings.cache_clear()
    https_client = TestClient(create_app(enable_auth=False), base_url="https://testserver")
    resp = https_client.get("/v1/health/live")
    assert "max-age=" in resp.headers["Strict-Transport-Security"]


def test_headers_present_on_error_responses(client: TestClient) -> None:
    resp = client.get("/v1/does-not-exist")
    assert resp.status_code == 404
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
