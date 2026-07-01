"""Session user id extraction (cookie session). Shared by auth and protected routes."""

from uuid import UUID

from fastapi import HTTPException, Request, status


def session_user_id_optional(request: Request) -> UUID | None:
    raw = request.session.get("user_id")
    if not raw:
        return None
    try:
        return UUID(str(raw))
    except (ValueError, TypeError):
        return None


def require_session_user_id(request: Request) -> UUID:
    uid = session_user_id_optional(request)
    if uid is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return uid
