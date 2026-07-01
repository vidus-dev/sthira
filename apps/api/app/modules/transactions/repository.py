from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import LedgerTransaction


class TransactionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def _active(self):
        return LedgerTransaction.deleted_at.is_(None)

    async def list_for_user(
        self, user_id: UUID, *, account_id: UUID | None = None
    ) -> list[LedgerTransaction]:
        q = select(LedgerTransaction).where(
            LedgerTransaction.user_id == user_id,
            self._active(),
        )
        if account_id is not None:
            q = q.where(LedgerTransaction.account_id == account_id)
        q = q.order_by(LedgerTransaction.occurred_at.desc())
        r = await self._session.execute(q)
        return list(r.scalars().all())

    async def get_for_user(self, user_id: UUID, tx_id: UUID) -> LedgerTransaction | None:
        r = await self._session.execute(
            select(LedgerTransaction).where(
                LedgerTransaction.id == tx_id,
                LedgerTransaction.user_id == user_id,
                self._active(),
            )
        )
        return r.scalar_one_or_none()

    async def get_for_user_for_update(self, user_id: UUID, tx_id: UUID) -> LedgerTransaction | None:
        r = await self._session.execute(
            select(LedgerTransaction)
            .where(
                LedgerTransaction.id == tx_id,
                LedgerTransaction.user_id == user_id,
                self._active(),
            )
            .with_for_update()
        )
        return r.scalar_one_or_none()

    async def add(self, row: LedgerTransaction) -> LedgerTransaction:
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return row

    async def soft_delete(self, row: LedgerTransaction) -> None:
        row.deleted_at = datetime.now(UTC)
        await self._session.flush()
