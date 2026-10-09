from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import LedgerTransaction


@dataclass(frozen=True, slots=True)
class TransactionFilter:
    account_id: UUID | None = None
    start: datetime | None = None  # inclusive
    end: datetime | None = None  # exclusive
    category_slug: str | None = None
    monthly_payment_id: UUID | None = None
    limit: int | None = None


class TransactionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def _active(self):
        return LedgerTransaction.deleted_at.is_(None)

    async def list_for_household(
        self, household_id: UUID, f: TransactionFilter = TransactionFilter()
    ) -> list[LedgerTransaction]:
        q = select(LedgerTransaction).where(
            LedgerTransaction.household_id == household_id,
            self._active(),
        )
        if f.account_id is not None:
            q = q.where(LedgerTransaction.account_id == f.account_id)
        if f.start is not None:
            q = q.where(LedgerTransaction.occurred_at >= f.start)
        if f.end is not None:
            q = q.where(LedgerTransaction.occurred_at < f.end)
        if f.category_slug is not None:
            q = q.where(LedgerTransaction.category_slug == f.category_slug)
        if f.monthly_payment_id is not None:
            q = q.where(LedgerTransaction.monthly_payment_id == f.monthly_payment_id)
        q = q.order_by(LedgerTransaction.occurred_at.desc(), LedgerTransaction.created_at.desc())
        if f.limit is not None:
            q = q.limit(f.limit)
        r = await self._session.execute(q)
        return list(r.scalars().all())

    async def get(self, household_id: UUID, tx_id: UUID) -> LedgerTransaction | None:
        r = await self._session.execute(
            select(LedgerTransaction).where(
                LedgerTransaction.id == tx_id,
                LedgerTransaction.household_id == household_id,
                self._active(),
            )
        )
        return r.scalar_one_or_none()

    async def get_for_update(self, household_id: UUID, tx_id: UUID) -> LedgerTransaction | None:
        r = await self._session.execute(
            select(LedgerTransaction)
            .where(
                LedgerTransaction.id == tx_id,
                LedgerTransaction.household_id == household_id,
                self._active(),
            )
            .with_for_update()
        )
        return r.scalar_one_or_none()

    async def transfer_legs_for_update(
        self, household_id: UUID, transfer_id: UUID
    ) -> list[LedgerTransaction]:
        """Both active legs of a transfer, locked (stable order avoids deadlocks)."""
        r = await self._session.execute(
            select(LedgerTransaction)
            .where(
                LedgerTransaction.household_id == household_id,
                LedgerTransaction.transfer_id == transfer_id,
                self._active(),
            )
            .order_by(LedgerTransaction.id)
            .with_for_update()
        )
        return list(r.scalars().all())

    async def source_ref_exists(self, household_id: UUID, source_ref: str) -> bool:
        """Any row (deleted ones too) with this import fingerprint — re-imports stay out."""
        return bool(
            await self._session.scalar(
                select(
                    exists().where(
                        LedgerTransaction.household_id == household_id,
                        LedgerTransaction.source_ref == source_ref,
                    )
                )
            )
        )

    async def add(self, row: LedgerTransaction) -> LedgerTransaction:
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return row

    async def soft_delete(self, row: LedgerTransaction) -> None:
        row.deleted_at = datetime.now(UTC)
        await self._session.flush()
