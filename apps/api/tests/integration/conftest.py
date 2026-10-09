"""Shared fixtures/helpers for DB-backed integration tests.

These tests require a real PostgreSQL database (the balance-consistency
guarantees rely on ``SELECT ... FOR UPDATE`` row locks, which SQLite cannot
model). The whole package is skipped when no database is reachable, so the
default unit-test suite stays green without infrastructure.

Point ``DATABASE_URL`` at a migrated database (``alembic upgrade head``) before
running:

    DATABASE_URL=postgresql+asyncpg://finance:finance@localhost:5432/finance \\
        poetry run pytest tests/integration
"""

from __future__ import annotations

import asyncio
import os
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://finance:finance@localhost:5432/finance"
)


def _db_reachable() -> bool:
    async def _check() -> bool:
        engine = create_async_engine(DATABASE_URL)
        try:
            async with engine.connect():
                return True
        except Exception:
            return False
        finally:
            await engine.dispose()

    try:
        return asyncio.run(_check())
    except Exception:
        return False


# Skip the entire integration package if there is no database to talk to.
if not _db_reachable():
    pytest.skip(
        "no database reachable for integration tests (set DATABASE_URL)",
        allow_module_level=True,
    )


def run(coro):
    """Run an async coroutine to completion in a fresh event loop."""
    return asyncio.run(coro)


def make_sessionmaker() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def create_actor(
    sessionmaker: async_sessionmaker[AsyncSession], *, household_id: uuid.UUID | None = None
):
    """Insert a throwaway user in a new household (or in ``household_id``); return an Actor."""
    from app.auth.actor import Actor
    from app.models.user import User
    from app.modules.households.service import create_household

    async with sessionmaker() as s:
        if household_id is None:
            household_id = (await create_household(s)).id
        user = User(
            email=f"itest-{uuid.uuid4()}@example.com",
            hashed_password="x",  # not exercising auth here
            household_id=household_id,
        )
        s.add(user)
        await s.commit()
        return Actor(user_id=user.id, household_id=household_id)


async def create_account(
    sessionmaker: async_sessionmaker[AsyncSession],
    actor,
    *,
    balance: str = "0",
    name: str = "Integration Test Account",
    currency: str = "INR",
    account_type: str = "savings",
) -> uuid.UUID:
    from decimal import Decimal

    from app.models.account import FinancialAccount

    account = FinancialAccount(
        user_id=actor.user_id,
        household_id=actor.household_id,
        display_name=name,
        balance=Decimal(balance),
        currency=currency,
        account_type=account_type,
    )
    async with sessionmaker() as s:
        s.add(account)
        await s.commit()
        return account.id


async def create_user_and_account(
    sessionmaker: async_sessionmaker[AsyncSession], *, starting_balance: str = "0"
):
    """Insert a throwaway user + account; return (actor, account_id)."""
    actor = await create_actor(sessionmaker)
    return actor, await create_account(sessionmaker, actor, balance=starting_balance)


async def fetch_balance(
    sessionmaker: async_sessionmaker[AsyncSession], account_id: uuid.UUID
):
    from app.models.account import FinancialAccount

    async with sessionmaker() as s:
        acc = await s.get(FinancialAccount, account_id)
        return acc.balance if acc else None
