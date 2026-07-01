"""DB-backed tests for the budget envelope use-cases."""

from __future__ import annotations

import uuid
from decimal import Decimal

from app.modules.budgets.schemas import BudgetCreate, BudgetUpdate
from app.modules.budgets.service import BudgetService

from tests.integration.conftest import create_user, make_sessionmaker, run


def _create(category="food", year=2026, month=6, limit="100", currency="INR") -> BudgetCreate:
    return BudgetCreate(
        category_slug=category, year=year, month=month,
        limit_amount=Decimal(limit), currency=currency,
    )


def test_upsert_creates_then_updates_in_place() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id = await create_user(sm)
        async with sm() as s:
            first = await BudgetService(s).upsert(user_id, _create(limit="100"))
        # Same (category, year, month) must update, not duplicate.
        async with sm() as s:
            second = await BudgetService(s).upsert(user_id, _create(limit="250"))
        assert second.id == first.id
        assert second.limit_amount == Decimal("250.0000")
        async with sm() as s:
            rows = await BudgetService(s).list_month(user_id, 2026, 6)
        assert len(rows) == 1

    run(scenario())


def test_update_changes_limit() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id = await create_user(sm)
        async with sm() as s:
            b = await BudgetService(s).upsert(user_id, _create(limit="100"))
        async with sm() as s:
            updated = await BudgetService(s).update(
                user_id, b.id, BudgetUpdate(limit_amount=Decimal("175"))
            )
        assert updated is not None
        assert updated.limit_amount == Decimal("175.0000")

    run(scenario())


def test_delete_removes_budget() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id = await create_user(sm)
        async with sm() as s:
            b = await BudgetService(s).upsert(user_id, _create())
        async with sm() as s:
            assert await BudgetService(s).delete(user_id, b.id) is True
        async with sm() as s:
            assert await BudgetService(s).get(user_id, b.id) is None

    run(scenario())


def test_get_unknown_returns_none() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id = await create_user(sm)
        async with sm() as s:
            assert await BudgetService(s).get(user_id, uuid.uuid4()) is None

    run(scenario())
