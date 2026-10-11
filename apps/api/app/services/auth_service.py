import secrets
from datetime import UTC, datetime
from uuid import UUID

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.modules.households.service import create_household
from app.schemas.auth import UserPublic


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


async def create_user(
    db: AsyncSession, email: str, password: str, display_name: str | None = None
) -> User:
    """Create a user in a fresh household of their own (seeded with default categories).

    A second person joins an existing household afterwards with its invite code.
    """
    household = await create_household(db)
    user = User(
        email=email.lower(),
        hashed_password=hash_password(password),
        display_name=display_name,
        household_id=household.id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate(db: AsyncSession, email: str, password: str) -> User | None:
    user = await get_user_by_email(db, email)
    if user is None:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def user_public(user: User) -> UserPublic:
    return UserPublic(
        id=str(user.id),
        email=user.email,
        role=user.role,
        display_name=user.display_name,
        household_id=str(user.household_id),
        has_recovery_key=user.recovery_key_hash is not None,
    )


# No 0/O/1/I/L so a key copied onto paper reads back cleanly.
_KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def new_recovery_key() -> str:
    """``7KQM-4ZTX-P9WD-3HCN`` — 16 characters (~79 bits), grouped for writing down."""
    chars = "".join(secrets.choice(_KEY_ALPHABET) for _ in range(16))
    return "-".join(chars[i : i + 4] for i in range(0, 16, 4))


def normalize_recovery_key(raw: str) -> str:
    cleaned = "".join(ch for ch in raw.upper() if ch.isalnum())
    return "-".join(cleaned[i : i + 4] for i in range(0, len(cleaned), 4))


async def issue_recovery_key(db: AsyncSession, user: User) -> str:
    """Create (or replace) the user's recovery key; the plain key is returned once."""
    key = new_recovery_key()
    user.recovery_key_hash = hash_password(key)
    user.recovery_key_created_at = datetime.now(UTC)
    await db.commit()
    return key


async def reset_password_with_key(
    db: AsyncSession, email: str, recovery_key: str, new_password: str
) -> User | None:
    """Set a new password if the recovery key matches. The key is used up."""
    user = await get_user_by_email(db, email)
    if user is None or user.recovery_key_hash is None:
        return None
    if not verify_password(normalize_recovery_key(recovery_key), user.recovery_key_hash):
        return None
    user.hashed_password = hash_password(new_password)
    user.recovery_key_hash = None
    user.recovery_key_created_at = None
    await db.commit()
    return user


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
