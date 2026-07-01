"""Account-to-account transfers — moves money between two of a user's accounts."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import LedgerTransaction
from app.modules.accounts.repository import AccountRepository
from app.modules.transactions.audit_repository import AuditRepository
from app.modules.transactions.repository import TransactionRepository
from app.modules.transfers.schemas import TransferCreate, TransferRead


class TransferService:
    def __init__(self, session: AsyncSession) -> None:
        self._accounts = AccountRepository(session)
        self._txs = TransactionRepository(session)
        self._audit = AuditRepository(session)
        self._session = session

    async def create(self, user_id: UUID, body: TransferCreate) -> TransferRead:
        if body.source_account_id == body.dest_account_id:
            raise ValueError("Cannot transfer to the same account")
        if body.amount <= Decimal("0"):
            raise ValueError("Transfer amount must be positive")

        occurred_at = body.occurred_at or datetime.now(UTC)
        async with self._session.begin():
            src = await self._accounts.get_for_user_for_update(user_id, body.source_account_id)
            if src is None:
                raise ValueError("Source account not found")
            dst = await self._accounts.get_for_user_for_update(user_id, body.dest_account_id)
            if dst is None:
                raise ValueError("Destination account not found")
            if src.currency != dst.currency:
                raise ValueError("Cross-currency transfers are not supported")

            transfer_id = uuid.uuid4()
            debit = LedgerTransaction(
                user_id=user_id,
                account_id=src.id,
                amount=-body.amount,
                description=body.description or f"Transfer to {dst.display_name}",
                category_slug="transfer",
                occurred_at=occurred_at,
                transfer_id=transfer_id,
            )
            credit = LedgerTransaction(
                user_id=user_id,
                account_id=dst.id,
                amount=body.amount,
                description=body.description or f"Transfer from {src.display_name}",
                category_slug="transfer",
                occurred_at=occurred_at,
                transfer_id=transfer_id,
            )
            src.balance = Decimal(src.balance) - body.amount
            dst.balance = Decimal(dst.balance) + body.amount
            now = datetime.now(UTC)
            src.updated_at = now
            dst.updated_at = now
            await self._txs.add(debit)
            await self._txs.add(credit)
            await self._audit.append(
                user_id=user_id,
                action="transfer.create",
                entity_type="transfer",
                entity_id=transfer_id,
                payload={
                    "source_account_id": str(src.id),
                    "dest_account_id": str(dst.id),
                    "amount": str(body.amount),
                },
            )
            return TransferRead(
                transfer_id=transfer_id,
                source_account_id=src.id,
                dest_account_id=dst.id,
                amount=body.amount,
                occurred_at=occurred_at,
                created_at=debit.created_at,
            )
