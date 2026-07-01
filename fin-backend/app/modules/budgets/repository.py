from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import BudgetLine


class BudgetRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_month(self, user_id: UUID, year: int, month: int) -> list[BudgetLine]:
        r = await self._session.execute(
            select(BudgetLine)
            .where(
                BudgetLine.user_id == user_id,
                BudgetLine.year == year,
                BudgetLine.month == month,
            )
            .order_by(BudgetLine.category_slug)
        )
        return list(r.scalars().all())

    async def get_for_user(self, user_id: UUID, budget_id: UUID) -> BudgetLine | None:
        r = await self._session.execute(
            select(BudgetLine).where(
                BudgetLine.id == budget_id,
                BudgetLine.user_id == user_id,
            )
        )
        return r.scalar_one_or_none()

    async def find_composite(
        self, user_id: UUID, category_slug: str, year: int, month: int
    ) -> BudgetLine | None:
        r = await self._session.execute(
            select(BudgetLine).where(
                BudgetLine.user_id == user_id,
                BudgetLine.category_slug == category_slug,
                BudgetLine.year == year,
                BudgetLine.month == month,
            )
        )
        return r.scalar_one_or_none()

    async def add(self, row: BudgetLine) -> BudgetLine:
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return row

    async def delete(self, row: BudgetLine) -> None:
        await self._session.delete(row)
