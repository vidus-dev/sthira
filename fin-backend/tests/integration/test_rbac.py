"""DB-backed RBAC tests driving the full app over HTTP (sessions + role gate)."""

from __future__ import annotations

import uuid

from app.auth.rbac import ROLE_ADMIN
from app.config import get_settings
from app.factory import create_app
from starlette.testclient import TestClient

from tests.integration.conftest import make_sessionmaker, run


async def _create_user_with_role(email: str, password: str, role: str) -> uuid.UUID:
    from app.models.user import User
    from app.services.auth_service import create_user

    sm = make_sessionmaker()
    async with sm() as s:
        user = await create_user(s, email, password)
    if role != "user":
        async with sm() as s:
            row = await s.get(User, user.id)
            row.role = role
            await s.commit()
    return user.id


def test_unauthenticated_request_is_401() -> None:
    get_settings.cache_clear()
    app = create_app(enable_auth=True)
    with TestClient(app) as client:
        resp = client.get("/v1/admin/users")
    assert resp.status_code == 401


def test_normal_user_is_forbidden_from_admin() -> None:
    get_settings.cache_clear()
    app = create_app(enable_auth=True)
    email = f"user-{uuid.uuid4()}@example.com"
    with TestClient(app) as client:
        reg = client.post("/v1/auth/register", json={"email": email, "password": "pw-123456"})
        assert reg.status_code == 201
        assert reg.json()["user"]["role"] == "user"

        resp = client.get("/v1/admin/users")
    assert resp.status_code == 403


def test_admin_user_can_list_users_and_audit_events() -> None:
    get_settings.cache_clear()
    app = create_app(enable_auth=True)
    email = f"admin-{uuid.uuid4()}@example.com"
    run(_create_user_with_role(email, "pw-123456", ROLE_ADMIN))

    with TestClient(app) as client:
        login = client.post("/v1/auth/login", json={"email": email, "password": "pw-123456"})
        assert login.status_code == 200
        assert login.json()["user"]["role"] == "admin"

        users = client.get("/v1/admin/users?limit=10")
        assert users.status_code == 200
        body = users.json()
        assert body["limit"] == 10
        assert body["total"] >= 1
        assert any(u["email"] == email for u in body["items"])

        audit = client.get("/v1/admin/audit-events?limit=5")
        assert audit.status_code == 200
        assert set(audit.json().keys()) == {"items", "total", "limit", "offset"}
