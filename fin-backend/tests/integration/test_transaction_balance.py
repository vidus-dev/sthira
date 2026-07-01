"""DB-backed tests for transaction/account balance consistency.

These exercise the real ``TransactionService`` against PostgreSQL and assert the
account balance stays correct across create/update/delete, idempotent replays,
and — most importantly — concurrent writes to the same account (where the
``SELECT ... FOR UPDATE`` row lock must prevent lost updates).
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from app.modules.transactions.schemas import TransactionCreate, TransactionUpdate
from app.modules.transactions.service import TransactionService

from tests.integration.conftest import (
    create_user_and_account,
    fetch_balance,
    make_sessionmaker,
    run,
)


def _body(account_id: uuid.UUID, amount: str) -> TransactionCreate:
    return TransactionCreate(
        account_id=account_id,
        amount=Decimal(amount),
        description="itest",
        occurred_at=datetime(2026, 6, 1, 12, 0, tzinfo=UTC),
    )


def test_create_increases_balance() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id, account_id = await create_user_and_account(sm, starting_balance="100")
        async with sm() as s:
            await TransactionService(s).create(user_id, _body(account_id, "250.50"))
        assert await fetch_balance(sm, account_id) == Decimal("350.5000")

    run(scenario())


def test_outflow_decreases_balance() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id, account_id = await create_user_and_account(sm, starting_balance="100")
        async with sm() as s:
            await TransactionService(s).create(user_id, _body(account_id, "-40"))
        assert await fetch_balance(sm, account_id) == Decimal("60.0000")

    run(scenario())


def test_update_amount_adjusts_balance_by_delta() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id, account_id = await create_user_and_account(sm, starting_balance="0")
        async with sm() as s:
            tx = await TransactionService(s).create(user_id, _body(account_id, "100"))
        # balance now 100; bump the transaction to 175 -> balance should be 175
        async with sm() as s:
            await TransactionService(s).update(
                user_id, tx.id, TransactionUpdate(amount=Decimal("175"))
            )
        assert await fetch_balance(sm, account_id) == Decimal("175.0000")

    run(scenario())


def test_delete_reverses_balance() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id, account_id = await create_user_and_account(sm, starting_balance="0")
        async with sm() as s:
            tx = await TransactionService(s).create(user_id, _body(account_id, "80"))
        async with sm() as s:
            deleted = await TransactionService(s).delete(user_id, tx.id)
        assert deleted is True
        assert await fetch_balance(sm, account_id) == Decimal("0.0000")

    run(scenario())


def test_double_delete_does_not_double_count() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id, account_id = await create_user_and_account(sm, starting_balance="0")
        async with sm() as s:
            tx = await TransactionService(s).create(user_id, _body(account_id, "80"))
        async with sm() as s:
            assert await TransactionService(s).delete(user_id, tx.id) is True
        # Second delete must be a no-op, not subtract 80 again.
        async with sm() as s:
            assert await TransactionService(s).delete(user_id, tx.id) is False
        assert await fetch_balance(sm, account_id) == Decimal("0.0000")

    run(scenario())


def test_idempotent_create_applies_once() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id, account_id = await create_user_and_account(sm, starting_balance="0")
        key = str(uuid.uuid4())
        async with sm() as s:
            first = await TransactionService(s).create(
                user_id, _body(account_id, "100"), idempotency_key=key
            )
        # Replaying the same key must return the same transaction and NOT
        # apply the amount a second time.
        async with sm() as s:
            replay = await TransactionService(s).create(
                user_id, _body(account_id, "100"), idempotency_key=key
            )
        assert replay.id == first.id
        assert await fetch_balance(sm, account_id) == Decimal("100.0000")

    run(scenario())


def test_create_unknown_account_raises() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id, _ = await create_user_and_account(sm)
        with pytest.raises(ValueError, match="Account not found"):
            async with sm() as s:
                await TransactionService(s).create(user_id, _body(uuid.uuid4(), "10"))

    run(scenario())


def test_concurrent_creates_keep_balance_consistent() -> None:
    """The critical one: two writers hitting the same account concurrently.

    Without the row lock this is a classic read-modify-write race and one
    update is lost. With ``FOR UPDATE`` the writes serialize and the final
    balance equals the sum of both.
    """

    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id, account_id = await create_user_and_account(sm, starting_balance="0")

        async def write(amount: str) -> None:
            async with sm() as s:
                await TransactionService(s).create(user_id, _body(account_id, amount))

        # Fan out many concurrent writers on the same account.
        amounts = ["10", "20", "30", "40", "50", "5", "15", "25"]
        await asyncio.gather(*(write(a) for a in amounts))

        expected = sum(Decimal(a) for a in amounts)  # 195
        assert await fetch_balance(sm, account_id) == expected.quantize(Decimal("0.0001"))

    run(scenario())
