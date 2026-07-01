"""DB-backed tests for auth service (password hashing + user lookup)."""

from __future__ import annotations

import uuid

from app.services.auth_service import (
    authenticate,
    create_user,
    get_user_by_email,
    get_user_by_id,
    hash_password,
    verify_password,
)

from tests.integration.conftest import make_sessionmaker, run


def test_password_hash_roundtrip() -> None:
    hashed = hash_password("s3cret-pw")
    assert hashed != "s3cret-pw"
    assert verify_password("s3cret-pw", hashed) is True
    assert verify_password("wrong", hashed) is False


def test_create_user_lowercases_email_and_authenticates() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        email = f"Mixed-{uuid.uuid4()}@Example.COM"
        async with sm() as s:
            user = await create_user(s, email, "pw-123456")
        assert user.email == email.lower()

        # Lookup is case-insensitive (stored lowercased).
        async with sm() as s:
            found = await get_user_by_email(s, email.upper())
        assert found is not None and found.id == user.id

        # Correct credentials authenticate; wrong password does not.
        async with sm() as s:
            assert (await authenticate(s, email, "pw-123456")) is not None
        async with sm() as s:
            assert (await authenticate(s, email, "nope")) is None

    run(scenario())


def test_authenticate_unknown_user_returns_none() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        async with sm() as s:
            assert await authenticate(s, f"ghost-{uuid.uuid4()}@example.com", "x") is None

    run(scenario())


def test_get_user_by_id() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        async with sm() as s:
            user = await create_user(s, f"byid-{uuid.uuid4()}@example.com", "pw-123456")
        async with sm() as s:
            again = await get_user_by_id(s, user.id)
        assert again is not None and again.id == user.id

    run(scenario())
