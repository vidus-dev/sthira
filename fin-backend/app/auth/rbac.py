"""Role-based access control.

Authorization in this app has two independent layers, applied together:

1. **Ownership** — every repository query is scoped by ``user_id`` so a user can
   only ever read or mutate their own rows (multi-tenancy / row-level isolation).
2. **Roles** — this module. ``require_role(...)`` gates whole endpoints on the
   caller's role (e.g. admin-only surfaces). It is *additive* to ownership, never
   a replacement: an admin endpoint still scopes data access where relevant.

Use ``require_current_user`` when a handler needs the authenticated ``User``
object, and ``require_role(...)`` / ``require_admin`` to gate by role.
"""

from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.session_user import require_session_user_id
from app.db.session import get_db
from app.models.user import User
from app.services.auth_service import get_user_by_id

ROLE_USER = "user"
ROLE_ADMIN = "admin"
VALID_ROLES: frozenset[str] = frozenset({ROLE_USER, ROLE_ADMIN})


async def require_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the authenticated session into a live ``User`` row.

    Clears a stale session and 401s if the referenced user no longer exists.
    """
    uid = require_session_user_id(request)
    user = await get_user_by_id(db, uid)
    if user is None:
        request.session.clear()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return user


def require_role(*roles: str) -> Callable[..., Coroutine[Any, Any, User]]:
    """Build a dependency that allows only callers holding one of ``roles``."""
    allowed = frozenset(roles)
    unknown = allowed - VALID_ROLES
    if unknown:
        raise ValueError(f"Unknown role(s): {sorted(unknown)}")

    async def _dependency(user: User = Depends(require_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return _dependency


# Convenience: admin-only gate.
require_admin = require_role(ROLE_ADMIN)
