"""Unit tests for the RBAC dependencies (no database).

We mount ``require_role(...)`` on a throwaway FastAPI app and override
``require_current_user`` to inject a user with a chosen role, so the gate logic
is exercised in isolation from sessions and the DB.
"""

import pytest
from app.auth.rbac import (
    ROLE_ADMIN,
    ROLE_USER,
    require_admin,
    require_current_user,
    require_role,
)
from app.models.user import User
from fastapi import Depends, FastAPI
from starlette.testclient import TestClient


def _fake_user(role: str) -> User:
    return User(email="someone@example.com", hashed_password="x", role=role)


def _app_with_gate(gate) -> FastAPI:
    app = FastAPI()

    @app.get("/guarded", dependencies=[Depends(gate)])
    def guarded() -> dict[str, bool]:
        return {"ok": True}

    return app


def test_require_role_allows_matching_role() -> None:
    app = _app_with_gate(require_role(ROLE_ADMIN))
    app.dependency_overrides[require_current_user] = lambda: _fake_user(ROLE_ADMIN)
    resp = TestClient(app).get("/guarded")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_require_role_forbids_other_role() -> None:
    app = _app_with_gate(require_role(ROLE_ADMIN))
    app.dependency_overrides[require_current_user] = lambda: _fake_user(ROLE_USER)
    resp = TestClient(app).get("/guarded")
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Insufficient permissions"


def test_require_role_accepts_any_of_multiple_roles() -> None:
    app = _app_with_gate(require_role(ROLE_USER, ROLE_ADMIN))
    app.dependency_overrides[require_current_user] = lambda: _fake_user(ROLE_USER)
    assert TestClient(app).get("/guarded").status_code == 200


def test_require_admin_is_admin_only() -> None:
    app = _app_with_gate(require_admin)
    app.dependency_overrides[require_current_user] = lambda: _fake_user(ROLE_USER)
    assert TestClient(app).get("/guarded").status_code == 403


def test_require_role_rejects_unknown_role_at_construction() -> None:
    with pytest.raises(ValueError):
        require_role("superuser")
