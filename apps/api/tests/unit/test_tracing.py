"""Tests for the opt-in OpenTelemetry tracing setup."""

from app.factory import create_app
from app.observability import tracing
from app.observability.metrics import _route_template
from fastapi import FastAPI


def test_tracing_noop_without_endpoint() -> None:
    app = FastAPI()
    assert tracing.configure_tracing(app, endpoint=None, service_name="svc") is False


def test_tracing_noop_with_empty_endpoint() -> None:
    app = FastAPI()
    assert tracing.configure_tracing(app, endpoint="", service_name="svc") is False


def test_route_template_sanitizes_uuid_when_no_route() -> None:
    # Build a request scope without a matched route to hit the sanitizer branch.
    from starlette.requests import Request

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/v1/transactions/123e4567-e89b-12d3-a456-426614174000",
        "headers": [],
        "query_string": b"",
    }
    req = Request(scope)
    assert _route_template(req) == "/v1/transactions/{id}"


def test_app_constructs_with_metrics_enabled() -> None:
    # Sanity: full app builds with the metrics middleware + /metrics route.
    app = create_app(enable_auth=False)
    paths = {r.path for r in app.routes}
    assert "/metrics" in paths
