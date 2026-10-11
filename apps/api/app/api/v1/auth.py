from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.csrf_token import new_csrf_token
from app.auth.login_throttle import clear_login_failures, is_login_throttled, record_login_failure
from app.auth.session_user import require_session_user_id, session_user_id_optional
from app.db.session import get_db
from app.schemas.auth import (
    ChangePasswordBody,
    LoginBody,
    ProfileUpdate,
    RecoveryKeyResponse,
    RegisterBody,
    ResetPasswordBody,
    SessionResponse,
    UserPublic,
)
from app.services.auth_service import (
    authenticate,
    create_user,
    get_user_by_email,
    get_user_by_id,
    hash_password,
    issue_recovery_key,
    reset_password_with_key,
    user_public,
    verify_password,
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
        user = await create_user(db, body.email, body.password, body.display_name)
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


@router.patch("/me")
async def update_profile(
    request: Request,
    body: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
) -> UserPublic:
    uid = require_session_user_id(request)
    user = await get_user_by_id(db, uid)
    if user is None:
        request.session.clear()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    if "display_name" in body.model_fields_set:
        user.display_name = body.display_name
    await db.commit()
    return user_public(user)


async def _current_user(request: Request, db: AsyncSession):
    uid = require_session_user_id(request)
    user = await get_user_by_id(db, uid)
    if user is None:
        request.session.clear()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


@router.post("/recovery-key")
async def create_recovery_key(
    request: Request, db: AsyncSession = Depends(get_db)
) -> RecoveryKeyResponse:
    """Create a new recovery key (replacing any old one). It is shown only this once."""
    user = await _current_user(request, db)
    return RecoveryKeyResponse(recovery_key=await issue_recovery_key(db, user))


@router.post("/reset-password")
async def reset_password(
    request: Request,
    body: ResetPasswordBody,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    """Forgotten password: email + recovery key + new password. Signs you in."""
    throttle_key = f"reset:{body.email}"
    if is_login_throttled(throttle_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Try again later.",
        )
    user = await reset_password_with_key(db, body.email, body.recovery_key, body.new_password)
    if user is None:
        record_login_failure(throttle_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="That email and recovery key don't match",
        )
    clear_login_failures(throttle_key)
    clear_login_failures(body.email)
    request.session.clear()
    request.session["user_id"] = str(user.id)
    csrf = _issue_csrf(request)
    return SessionResponse(authenticated=True, user=user_public(user), csrf_token=csrf)


@router.post("/change-password")
async def change_password(
    request: Request,
    body: ChangePasswordBody,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    user = await _current_user(request, db)
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Your current password isn't right"
        )
    user.hashed_password = hash_password(body.new_password)
    await db.commit()
    return {"ok": True}


@router.post("/logout")
async def logout(request: Request) -> dict[str, bool]:
    request.session.clear()
    return {"ok": True}
