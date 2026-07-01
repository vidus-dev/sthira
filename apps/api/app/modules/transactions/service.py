"""Ledger transaction use-cases — keeps account balance consistent."""

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import LedgerTransaction
from app.modules.accounts.repository import AccountRepository
from app.modules.transactions.audit_repository import AuditRepository
from app.modules.transactions.idempotency_repository import (
    IDEMPOTENCY_SCOPE_TX_CREATE,
    IdempotencyRepository,
)
from app.modules.transactions.repository import TransactionRepository
from app.modules.transactions.schemas import TransactionCreate, TransactionRead, TransactionUpdate


class TransactionService:
    def __init__(self, session: AsyncSession) -> None:
        self._repo = TransactionRepository(session)
        self._accounts = AccountRepository(session)
        self._idempotency = IdempotencyRepository(session)
        self._audit = AuditRepository(session)
        self._session = session

    def _to_read(self, t: LedgerTransaction) -> TransactionRead:
        return TransactionRead.model_validate(t)

    async def list_transactions(
        self, user_id: UUID, *, account_id: UUID | None = None
    ) -> list[TransactionRead]:
        rows = await self._repo.list_for_user(user_id, account_id=account_id)
        return [self._to_read(x) for x in rows]

    async def get(self, user_id: UUID, tx_id: UUID) -> TransactionRead | None:
        row = await self._repo.get_for_user(user_id, tx_id)
        return self._to_read(row) if row else None

    async def create(
        self, user_id: UUID, body: TransactionCreate, idempotency_key: str | None = None
    ) -> TransactionRead:
        async with self._session.begin():
            idem_row = None
            if idempotency_key:
                idem_row, replay = await self._idempotency.claim_or_get_replay(
                    user_id, IDEMPOTENCY_SCOPE_TX_CREATE, idempotency_key
                )
                if replay is not None:
                    return TransactionRead.model_validate(replay)

            acc = await self._accounts.get_for_user_for_update(user_id, body.account_id)
            if acc is None:
                raise ValueError("Account not found")
            row = LedgerTransaction(
                user_id=user_id,
                account_id=body.account_id,
                amount=body.amount,
                description=body.description,
                category_slug=body.category_slug,
                occurred_at=body.occurred_at,
                notes=body.notes,
            )
            acc.balance = Decimal(acc.balance) + body.amount
            acc.updated_at = datetime.now(UTC)
            await self._repo.add(row)
            read = self._to_read(row)
            await self._audit.append(
                user_id=user_id,
                action="transaction.create",
                entity_type="ledger_transaction",
                entity_id=row.id,
                payload={
                    "account_id": str(body.account_id),
                    "amount": str(body.amount),
                    "description": body.description,
                },
            )
            if idempotency_key and idem_row is not None:
                self._idempotency.attach_response(idem_row, read.model_dump(mode="json"), 201)
            return read

    async def update(self, user_id: UUID, tx_id: UUID, body: TransactionUpdate) -> TransactionRead | None:
        async with self._session.begin():
            row = await self._repo.get_for_user_for_update(user_id, tx_id)
            if row is None:
                return None
            acc = await self._accounts.get_for_user_for_update(user_id, row.account_id)
            if acc is None:
                return None
            data = body.model_dump(exclude_unset=True)
            old_amount = row.amount
            for k, v in data.items():
                setattr(row, k, v)
            if "amount" in data:
                delta = row.amount - old_amount
                acc.balance = Decimal(acc.balance) + delta
            acc.updated_at = datetime.now(UTC)
            await self._session.flush()
            await self._session.refresh(row)
            read = self._to_read(row)
            await self._audit.append(
                user_id=user_id,
                action="transaction.update",
                entity_type="ledger_transaction",
                entity_id=row.id,
                payload={"fields": list(data.keys())},
            )
            return read

    async def delete(self, user_id: UUID, tx_id: UUID) -> bool:
        async with self._session.begin():
            row = await self._repo.get_for_user_for_update(user_id, tx_id)
            if row is None:
                return False
            acc = await self._accounts.get_for_user_for_update(user_id, row.account_id)
            if acc is None:
                return False
            acc.balance = Decimal(acc.balance) - row.amount
            acc.updated_at = datetime.now(UTC)
            await self._repo.soft_delete(row)
            await self._audit.append(
                user_id=user_id,
                action="transaction.delete",
                entity_type="ledger_transaction",
                entity_id=row.id,
                payload={"amount": str(row.amount)},
            )
            return True
