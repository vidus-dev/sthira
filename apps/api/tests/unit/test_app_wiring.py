"""App-level integration tests that do not touch the database.

``create_app(enable_auth=False)`` wires the health router, root route, and the
request-id / access-log / CORS middleware. We drive it with Starlette's
``TestClient`` *without* the context-manager form, so the lifespan (and its
``init_db``) never runs — keeping these tests DB-free and CI-safe.
"""

import pytest
from app.config import get_settings
from app.factory import create_app
from starlette.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    get_settings.cache_clear()
    app = create_app(enable_auth=False)
    return TestClient(app)


def test_full_app_constructs_with_auth_enabled() -> None:
    """Regression: the auth stack must wire up without import cycles.

    Constructing with ``enable_auth=True`` imports the auth routes and CSRF/
    session middleware; a circular import here previously broke ``app.main``.
    """
    get_settings.cache_clear()
    app = create_app(enable_auth=True)
    paths = {route.path for route in app.routes}
    assert "/v1/auth/login" in paths
    assert "/v1/transactions" in paths or any(p.startswith("/v1/") for p in paths)


def test_root_returns_service_metadata(client: TestClient) -> None:
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json() == {"service": "finance-api", "docs": "/docs"}


def test_health_live_is_ok(client: TestClient) -> None:
    resp = client.get("/v1/health/live")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_generates_request_id_when_absent(client: TestClient) -> None:
    resp = client.get("/v1/health/live")
    rid = resp.headers.get("X-Request-Id")
    assert rid
    # Looks like a UUID (generated, not echoed).
    assert len(rid) >= 32


def test_propagates_incoming_request_id(client: TestClient) -> None:
    resp = client.get("/v1/health/live", headers={"X-Request-Id": "trace-abc"})
    assert resp.headers["X-Request-Id"] == "trace-abc"


def test_unknown_route_returns_problem_json(client: TestClient) -> None:
    resp = client.get("/v1/does-not-exist")
    assert resp.status_code == 404
    assert resp.headers["content-type"].startswith("application/problem+json")
    body = resp.json()
    assert body["status"] == 404
    assert body["title"] == "Not found"
    assert body["request_id"]


def test_access_log_emitted_with_context(client: TestClient, caplog) -> None:
    import logging

    with caplog.at_level(logging.INFO, logger="app.access"):
        client.get("/v1/health/live", headers={"X-Request-Id": "trace-xyz"})

    records = [r for r in caplog.records if r.name == "app.access"]
    assert records, "expected an access-log record"
    rec = records[-1]
    assert rec.request_id == "trace-xyz"
    assert rec.method == "GET"
    assert rec.path == "/v1/health/live"
    assert rec.status_code == 200
    assert isinstance(rec.duration_ms, float)
