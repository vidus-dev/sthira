"""Monthly budget envelope use-cases."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import BudgetLine
from app.modules.budgets.repository import BudgetRepository
from app.modules.budgets.schemas import BudgetCreate, BudgetRead, BudgetUpdate


class BudgetService:
    def __init__(self, session: AsyncSession) -> None:
        self._repo = BudgetRepository(session)
        self._session = session

    def _to_read(self, b: BudgetLine) -> BudgetRead:
        return BudgetRead.model_validate(b)

    async def list_month(self, user_id: UUID, year: int, month: int) -> list[BudgetRead]:
        rows = await self._repo.list_month(user_id, year, month)
        return [self._to_read(x) for x in rows]

    async def get(self, user_id: UUID, budget_id: UUID) -> BudgetRead | None:
        row = await self._repo.get_for_user(user_id, budget_id)
        return self._to_read(row) if row else None

    async def upsert(self, user_id: UUID, body: BudgetCreate) -> BudgetRead:
        existing = await self._repo.find_composite(
            user_id, body.category_slug, body.year, body.month
        )
        if existing:
            existing.limit_amount = body.limit_amount
            existing.currency = body.currency
            existing.updated_at = datetime.now(UTC)
            await self._session.commit()
            await self._session.refresh(existing)
            return self._to_read(existing)
        row = BudgetLine(
            user_id=user_id,
            category_slug=body.category_slug,
            year=body.year,
            month=body.month,
            limit_amount=body.limit_amount,
            currency=body.currency,
        )
        try:
            await self._repo.add(row)
            await self._session.commit()
            await self._session.refresh(row)
        except IntegrityError:
            await self._session.rollback()
            raise
        return self._to_read(row)

    async def update(self, user_id: UUID, budget_id: UUID, body: BudgetUpdate) -> BudgetRead | None:
        row = await self._repo.get_for_user(user_id, budget_id)
        if row is None:
            return None
        if body.limit_amount is not None:
            row.limit_amount = body.limit_amount
        if body.currency is not None:
            row.currency = body.currency
        row.updated_at = datetime.now(UTC)
        await self._session.commit()
        await self._session.refresh(row)
        return self._to_read(row)

    async def delete(self, user_id: UUID, budget_id: UUID) -> bool:
        row = await self._repo.get_for_user(user_id, budget_id)
        if row is None:
            return False
        await self._repo.delete(row)
        await self._session.commit()
        return True
