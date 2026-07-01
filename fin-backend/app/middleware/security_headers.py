"""Security response headers for the API.

Adds a conservative set of hardening headers to every response. The API returns
JSON, so a strict ``default-src 'none'`` CSP is appropriate — except for the
interactive docs (Swagger UI / ReDoc), which load scripts and styles and would
break under it, so CSP is skipped there.

HSTS is only emitted for HTTPS requests (it is meaningless and potentially
harmful over plain HTTP), which in practice means staging/production behind TLS.
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Paths whose responses render HTML/JS and must not get the strict API CSP.
_CSP_EXEMPT_PREFIXES = ("/docs", "/redoc", "/openapi.json")

_STRICT_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
_PERMISSIONS_POLICY = "geolocation=(), microphone=(), camera=(), payment=()"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        headers = response.headers

        headers.setdefault("X-Content-Type-Options", "nosniff")
        headers.setdefault("X-Frame-Options", "DENY")
        headers.setdefault("Referrer-Policy", "no-referrer")
        headers.setdefault("Permissions-Policy", _PERMISSIONS_POLICY)
        headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")

        path = request.url.path
        if not path.startswith(_CSP_EXEMPT_PREFIXES):
            headers.setdefault("Content-Security-Policy", _STRICT_CSP)

        if request.url.scheme == "https":
            headers.setdefault(
                "Strict-Transport-Security",
                "max-age=63072000; includeSubDomains; preload",
            )

        return response
