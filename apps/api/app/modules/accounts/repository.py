from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import FinancialAccount


class AccountRepository:
    """Accounts are shared by every member of a household."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_household(self, household_id: UUID) -> list[FinancialAccount]:
        r = await self._session.execute(
            select(FinancialAccount)
            .where(FinancialAccount.household_id == household_id)
            .order_by(FinancialAccount.created_at.desc())
        )
        return list(r.scalars().all())

    async def get(self, household_id: UUID, account_id: UUID) -> FinancialAccount | None:
        r = await self._session.execute(
            select(FinancialAccount).where(
                FinancialAccount.id == account_id,
                FinancialAccount.household_id == household_id,
            )
        )
        return r.scalar_one_or_none()

    async def get_for_update(
        self, household_id: UUID, account_id: UUID
    ) -> FinancialAccount | None:
        r = await self._session.execute(
            select(FinancialAccount)
            .where(
                FinancialAccount.id == account_id,
                FinancialAccount.household_id == household_id,
            )
            .with_for_update()
        )
        return r.scalar_one_or_none()

    async def add(self, row: FinancialAccount) -> FinancialAccount:
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return row

    async def clear_default_flag(self, household_id: UUID, except_id: UUID | None = None) -> None:
        q = (
            update(FinancialAccount)
            .where(FinancialAccount.household_id == household_id)
            .values(is_default=False)
        )
        if except_id is not None:
            q = q.where(FinancialAccount.id != except_id)
        await self._session.execute(q)

    async def delete(self, row: FinancialAccount) -> None:
        await self._session.delete(row)
