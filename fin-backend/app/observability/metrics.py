"""Prometheus metrics for the API.

Exposes request counters, a latency histogram, and an in-progress gauge, plus a
``/metrics`` endpoint in the standard Prometheus text format. Path labels use
the matched *route template* (e.g. ``/v1/transactions/{tx_id}``) rather than the
raw URL, so path parameters don't explode label cardinality.
"""

from __future__ import annotations

import re
import time

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests.",
    ["method", "path", "status"],
)
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds.",
    ["method", "path"],
)
REQUESTS_IN_PROGRESS = Gauge(
    "http_requests_in_progress",
    "HTTP requests currently being served.",
    ["method"],
)

_UUID_RE = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.IGNORECASE
)
_NUM_RE = re.compile(r"/\d+(?=/|$)")


def _route_template(request: Request) -> str:
    """Low-cardinality label: prefer the matched route template, else sanitize."""
    route = request.scope.get("route")
    path = getattr(route, "path", None)
    if path:
        return path
    raw = request.url.path
    raw = _UUID_RE.sub("{id}", raw)
    raw = _NUM_RE.sub("/{id}", raw)
    return raw


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        method = request.method
        REQUESTS_IN_PROGRESS.labels(method=method).inc()
        start = time.perf_counter()
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        except Exception:
            status = 500
            raise
        finally:
            elapsed = time.perf_counter() - start
            path = _route_template(request)
            REQUEST_LATENCY.labels(method=method, path=path).observe(elapsed)
            REQUEST_COUNT.labels(method=method, path=path, status=str(status)).inc()
            REQUESTS_IN_PROGRESS.labels(method=method).dec()


async def metrics_endpoint(_request: Request) -> Response:
    """Render metrics in the Prometheus exposition format."""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
