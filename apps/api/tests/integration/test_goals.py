"""DB-backed tests for the goal use-cases (service + calculator + repo)."""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from app.modules.goals.schemas import FinancialGoalCreate, FinancialGoalUpdate
from app.modules.goals.service import GoalService

from tests.integration.conftest import create_user, make_sessionmaker, run


def _create(name="Trip", target="1000", saved="0") -> FinancialGoalCreate:
    return FinancialGoalCreate(
        name=name, target_amount=Decimal(target), saved_amount=Decimal(saved)
    )


def test_create_goal_computes_progress() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id = await create_user(sm)
        async with sm() as s:
            goal = await GoalService(s).create_goal(user_id, _create(target="1000", saved="250"))
        assert goal.progress == Decimal("0.2500")
        # Open-ended goal (no target_date) -> no suggested contribution.
        assert goal.suggested_monthly_contribution is None

    run(scenario())


def test_create_goal_rejects_saved_over_target() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id = await create_user(sm)
        with pytest.raises(ValueError, match="exceed target"):
            async with sm() as s:
                await GoalService(s).create_goal(user_id, _create(target="100", saved="200"))

    run(scenario())


def test_update_goal_persists_and_validates() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id = await create_user(sm)
        async with sm() as s:
            goal = await GoalService(s).create_goal(user_id, _create(target="1000", saved="0"))
        async with sm() as s:
            updated = await GoalService(s).update_goal(
                user_id, goal.id, FinancialGoalUpdate(saved_amount=Decimal("500"))
            )
        assert updated is not None
        assert updated.progress == Decimal("0.5000")
        # Pushing saved over target must be rejected.
        with pytest.raises(ValueError, match="exceed target"):
            async with sm() as s:
                await GoalService(s).update_goal(
                    user_id, goal.id, FinancialGoalUpdate(saved_amount=Decimal("2000"))
                )

    run(scenario())


def test_delete_goal() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id = await create_user(sm)
        async with sm() as s:
            goal = await GoalService(s).create_goal(user_id, _create())
        async with sm() as s:
            assert await GoalService(s).delete_goal(user_id, goal.id) is True
        async with sm() as s:
            assert await GoalService(s).get_goal(user_id, goal.id) is None

    run(scenario())


def test_get_unknown_goal_returns_none() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id = await create_user(sm)
        async with sm() as s:
            assert await GoalService(s).get_goal(user_id, uuid.uuid4()) is None

    run(scenario())
