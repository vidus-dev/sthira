from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.api.problem import problem_body


class CsrfProtectMiddleware(BaseHTTPMiddleware):
    """Require X-CSRF-Token for mutating /v1 requests when a session user is present."""

    EXEMPT_PATHS: frozenset[str] = frozenset(
        {
            "/v1/auth/login",
            "/v1/auth/register",
        }
    )

    async def dispatch(self, request: Request, call_next) -> Response:
        method = request.method.upper()
        if method in ("GET", "HEAD", "OPTIONS"):
            return await call_next(request)

        path = request.url.path.rstrip("/") or "/"
        if not path.startswith("/v1/"):
            return await call_next(request)

        normalized = path
        if normalized in self.EXEMPT_PATHS:
            return await call_next(request)
        if normalized.startswith("/v1/health"):
            return await call_next(request)

        session = request.session
        uid = session.get("user_id")
        if not uid:
            return await call_next(request)

        token = request.headers.get("x-csrf-token")
        expected = session.get("csrf_token")
        if not expected or not token or token != expected:
            rid = getattr(request.state, "request_id", None)
            return JSONResponse(
                status_code=403,
                content=problem_body(
                    status=403,
                    title="Forbidden",
                    detail="Missing or invalid CSRF token. Call GET /v1/auth/session after login and send X-CSRF-Token on writes.",
                    instance=str(request.url.path),
                    request_id=str(rid) if rid is not None else None,
                ),
                media_type="application/problem+json",
            )

        return await call_next(request)
