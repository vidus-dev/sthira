"""Persistence only — no business rules beyond household scoping."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import FinancialGoal


class GoalRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_household(self, household_id: UUID) -> list[FinancialGoal]:
        result = await self._session.execute(
            select(FinancialGoal)
            .where(FinancialGoal.household_id == household_id)
            .order_by(FinancialGoal.created_at.desc())
        )
        return list(result.scalars().all())

    async def get(self, household_id: UUID, goal_id: UUID) -> FinancialGoal | None:
        result = await self._session.execute(
            select(FinancialGoal).where(
                FinancialGoal.id == goal_id,
                FinancialGoal.household_id == household_id,
            )
        )
        return result.scalar_one_or_none()

    async def add(self, goal: FinancialGoal) -> FinancialGoal:
        self._session.add(goal)
        await self._session.flush()
        await self._session.refresh(goal)
        return goal

    async def delete(self, goal: FinancialGoal) -> None:
        await self._session.delete(goal)
