from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.csrf_token import new_csrf_token
from app.auth.login_throttle import clear_login_failures, is_login_throttled, record_login_failure
from app.auth.session_user import session_user_id_optional
from app.db.session import get_db
from app.schemas.auth import LoginBody, RegisterBody, SessionResponse
from app.services.auth_service import (
    authenticate,
    create_user,
    get_user_by_email,
    get_user_by_id,
    user_public,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_csrf(request: Request) -> str:
    token = new_csrf_token()
    request.session["csrf_token"] = token
    return token


def _ensure_csrf(request: Request) -> str | None:
    existing = request.session.get("csrf_token")
    if isinstance(existing, str) and existing:
        return existing
    token = new_csrf_token()
    request.session["csrf_token"] = token
    return token


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    body: RegisterBody,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    existing = await get_user_by_email(db, body.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    try:
        user = await create_user(db, body.email, body.password)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered") from None
    request.session["user_id"] = str(user.id)
    csrf = _issue_csrf(request)
    return SessionResponse(authenticated=True, user=user_public(user), csrf_token=csrf)


@router.post("/login")
async def login(
    request: Request,
    body: LoginBody,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    if is_login_throttled(body.email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Try again later.",
        )
    user = await authenticate(db, body.email, body.password)
    if user is None:
        record_login_failure(body.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    clear_login_failures(body.email)
    request.session["user_id"] = str(user.id)
    csrf = _issue_csrf(request)
    return SessionResponse(authenticated=True, user=user_public(user), csrf_token=csrf)


@router.get("/session")
async def session(request: Request, db: AsyncSession = Depends(get_db)) -> SessionResponse:
    uid = session_user_id_optional(request)
    if uid is None:
        return SessionResponse(authenticated=False, user=None, csrf_token=None)
    user = await get_user_by_id(db, uid)
    if user is None:
        request.session.clear()
        return SessionResponse(authenticated=False, user=None, csrf_token=None)
    csrf = _ensure_csrf(request)
    return SessionResponse(authenticated=True, user=user_public(user), csrf_token=csrf)


@router.post("/logout")
async def logout(request: Request) -> dict[str, bool]:
    request.session.clear()
    return {"ok": True}
