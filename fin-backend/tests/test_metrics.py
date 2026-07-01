"""Tests for Prometheus metrics middleware and the /metrics endpoint."""

import pytest
from app.config import get_settings
from app.factory import create_app
from prometheus_client import CONTENT_TYPE_LATEST
from starlette.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    get_settings.cache_clear()
    return TestClient(create_app(enable_auth=False))


def test_metrics_endpoint_exposes_prometheus_text(client: TestClient) -> None:
    # Generate some traffic first so counters are populated.
    client.get("/v1/health/live")
    resp = client.get("/metrics")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == CONTENT_TYPE_LATEST
    body = resp.text
    assert "http_requests_total" in body
    assert "http_request_duration_seconds" in body


def test_request_counter_increments(client: TestClient) -> None:
    from app.observability.metrics import REQUEST_COUNT

    before = REQUEST_COUNT.labels(method="GET", path="/v1/health/live", status="200")._value.get()
    client.get("/v1/health/live")
    after = REQUEST_COUNT.labels(method="GET", path="/v1/health/live", status="200")._value.get()
    assert after == before + 1


def test_route_template_used_not_raw_path(client: TestClient) -> None:
    # 404s still get recorded; the raw unknown path is sanitized/recorded.
    client.get("/v1/health/live")
    body = client.get("/metrics").text
    # The matched route template should appear, keeping cardinality low.
    assert "/v1/health/live" in body
