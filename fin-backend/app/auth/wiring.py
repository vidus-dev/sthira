"""Session cookie + CSRF + `/v1/auth/*` routes.

Run the full API:

    uvicorn app.main:app --reload

Middleware order (outer → inner): RequestId → CORS → Session → CSRF → routes.
"""

from fastapi import APIRouter, FastAPI
from starlette.middleware.sessions import SessionMiddleware

from app.api.v1 import auth as auth_v1
from app.auth.csrf_token import new_csrf_token  # re-exported for backwards compatibility
from app.config import get_settings
from app.middleware.csrf import CsrfProtectMiddleware

__all__ = ["install_auth_stack", "include_auth_routes", "new_csrf_token"]


def install_auth_stack(app: FastAPI) -> None:
    """CSRF must be inner to Session so `request.session` is populated before CSRF runs."""
    app.add_middleware(CsrfProtectMiddleware)
    settings = get_settings()
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.secret_key,
        session_cookie="session",
        max_age=14 * 24 * 60 * 60,
        same_site=settings.session_same_site,
        https_only=settings.session_cookie_https_only,
    )


def include_auth_routes(v1: APIRouter) -> None:
    v1.include_router(auth_v1.router)
