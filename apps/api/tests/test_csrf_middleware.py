"""Tests for CsrfProtectMiddleware in isolation.

Builds a minimal Starlette app with SessionMiddleware + the CSRF middleware so
we can exercise the protection logic without the database or auth stack.
"""

import pytest
from app.middleware.csrf import CsrfProtectMiddleware
from starlette.applications import Starlette
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient


async def _login(request):
    """Simulate an authenticated session with a known CSRF token."""
    request.session["user_id"] = "user-1"
    request.session["csrf_token"] = "secret-token"
    return JSONResponse({"ok": True})


async def _logout(request):
    request.session.clear()
    return JSONResponse({"ok": True})


async def _write(request):
    return JSONResponse({"written": True})


def _make_app() -> Starlette:
    app = Starlette(
        routes=[
            Route("/login", _login, methods=["POST"]),
            Route("/logout", _logout, methods=["POST"]),
            Route("/v1/items", _write, methods=["POST"]),
            Route("/v1/items", _write, methods=["GET"]),
            Route("/v1/auth/login", _write, methods=["POST"]),
        ]
    )
    # CSRF added first so SessionMiddleware (added last) wraps it -> session ready.
    app.add_middleware(CsrfProtectMiddleware)
    app.add_middleware(SessionMiddleware, secret_key="x" * 32)
    return app


@pytest.fixture
def client() -> TestClient:
    return TestClient(_make_app())


def test_get_requests_skip_csrf(client: TestClient) -> None:
    assert client.get("/v1/items").status_code == 200


def test_anonymous_write_is_allowed(client: TestClient) -> None:
    # No session user yet -> CSRF not enforced.
    assert client.post("/v1/items").status_code == 200


def test_exempt_auth_path_skips_csrf(client: TestClient) -> None:
    client.post("/login")
    assert client.post("/v1/auth/login").status_code == 200


def test_authenticated_write_without_token_is_forbidden(client: TestClient) -> None:
    client.post("/login")
    resp = client.post("/v1/items")
    assert resp.status_code == 403
    assert resp.headers["content-type"].startswith("application/problem+json")
    assert resp.json()["title"] == "Forbidden"


def test_authenticated_write_with_wrong_token_is_forbidden(client: TestClient) -> None:
    client.post("/login")
    resp = client.post("/v1/items", headers={"X-CSRF-Token": "wrong"})
    assert resp.status_code == 403


def test_authenticated_write_with_valid_token_succeeds(client: TestClient) -> None:
    client.post("/login")
    resp = client.post("/v1/items", headers={"X-CSRF-Token": "secret-token"})
    assert resp.status_code == 200
    assert resp.json() == {"written": True}
