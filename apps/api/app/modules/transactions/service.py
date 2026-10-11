"""Ledger transaction use-cases — keeps account balance consistent."""

from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor
from app.models.monthly_payment import MonthlyPayment
from app.models.transaction import LedgerTransaction
from app.modules.accounts.repository import AccountRepository
from app.modules.errors import ConflictError
from app.modules.month_plans import linking
from app.modules.periods import household_timezone, month_start, period_for
from app.modules.transactions.audit_repository import AuditRepository
from app.modules.transactions.idempotency_repository import (
    IDEMPOTENCY_SCOPE_TX_CREATE,
    IdempotencyRepository,
)
from app.modules.transactions.repository import TransactionFilter, TransactionRepository
from app.modules.transactions.schemas import TransactionCreate, TransactionRead, TransactionUpdate


async def plan_item_exists(session: AsyncSession, household_id: UUID, item_id: UUID) -> bool:
    return bool(
        await session.scalar(
            select(
                exists().where(
                    MonthlyPayment.id == item_id, MonthlyPayment.household_id == household_id
                )
            )
        )
    )


class TransactionService:
    def __init__(self, session: AsyncSession) -> None:
        self._repo = TransactionRepository(session)
        self._accounts = AccountRepository(session)
        self._idempotency = IdempotencyRepository(session)
        self._audit = AuditRepository(session)
        self._session = session

    def _to_read(self, t: LedgerTransaction) -> TransactionRead:
        return TransactionRead.model_validate(t)

    async def _plan_period(
        self, actor: Actor, item_id: UUID, period: date | None, occurred_at: datetime
    ) -> date:
        """Validate the plan item and resolve the month the payment counts towards."""
        if not await plan_item_exists(self._session, actor.household_id, item_id):
            raise ValueError("Monthly plan item not found")
        if period is not None:
            return month_start(period)
        return period_for(occurred_at, await household_timezone(self._session, actor.household_id))

    async def list_transactions(
        self, actor: Actor, f: TransactionFilter = TransactionFilter()
    ) -> list[TransactionRead]:
        rows = await self._repo.list_for_household(actor.household_id, f)
        return [self._to_read(x) for x in rows]

    async def get(self, actor: Actor, tx_id: UUID) -> TransactionRead | None:
        row = await self._repo.get(actor.household_id, tx_id)
        return self._to_read(row) if row else None

    async def create(
        self, actor: Actor, body: TransactionCreate, idempotency_key: str | None = None
    ) -> TransactionRead:
        async with self._session.begin():
            idem_row = None
            if idempotency_key:
                idem_row, replay = await self._idempotency.claim_or_get_replay(
                    actor.user_id, IDEMPOTENCY_SCOPE_TX_CREATE, idempotency_key
                )
                if replay is not None:
                    return TransactionRead.model_validate(replay)

            if body.source_ref and await self._repo.source_ref_exists(
                actor.household_id, body.source_ref
            ):
                raise ConflictError("This transaction was already imported")

            period = None
            plan_item = None
            if body.plan_item_id is not None:
                plan_item, period = await linking.resolve_item(
                    self._session, actor.household_id, body.plan_item_id
                )
            elif body.monthly_payment_id is not None:
                period = await self._plan_period(
                    actor, body.monthly_payment_id, body.period_month, body.occurred_at
                )
                plan_item = await linking.item_for_template(
                    self._session, actor.household_id, body.monthly_payment_id, period
                )

            acc = await self._accounts.get_for_update(actor.household_id, body.account_id)
            if acc is None:
                raise ValueError("Account not found")
            row = LedgerTransaction(
                user_id=actor.user_id,
                household_id=actor.household_id,
                account_id=body.account_id,
                amount=body.amount,
                description=body.description,
                category_slug=body.category_slug,
                occurred_at=body.occurred_at,
                notes=body.notes,
                source=body.source,
                source_ref=body.source_ref,
                monthly_payment_id=body.monthly_payment_id,
                period_month=period,
            )
            if plan_item is not None:
                linking.link(row, plan_item, period)
            acc.balance = Decimal(acc.balance) + body.amount
            acc.updated_at = datetime.now(UTC)
            await self._repo.add(row)
            # "Rent 37,000" ticks off this month's rent.
            await linking.auto_link_bill(
                self._session,
                actor.household_id,
                row,
                await household_timezone(self._session, actor.household_id),
            )
            await self._session.flush()
            read = self._to_read(row)
            await self._audit.append(
                user_id=actor.user_id,
                action="transaction.create",
                entity_type="ledger_transaction",
                entity_id=row.id,
                payload={
                    "account_id": str(body.account_id),
                    "amount": str(body.amount),
                    "description": body.description,
                    "source": body.source,
                },
            )
            if idempotency_key and idem_row is not None:
                self._idempotency.attach_response(idem_row, read.model_dump(mode="json"), 201)
            return read

    async def update(
        self, actor: Actor, tx_id: UUID, body: TransactionUpdate
    ) -> TransactionRead | None:
        async with self._session.begin():
            row = await self._repo.get_for_update(actor.household_id, tx_id)
            if row is None:
                return None
            data = body.model_dump(exclude_unset=True)
            plan_fields = {
                k: data.pop(k)
                for k in ("monthly_payment_id", "period_month", "plan_item_id")
                if k in data
            }

            # A transfer is two legs: amount, date and note changes apply to both, each
            # leg keeping its direction, and both balances move.
            legs = [row]
            if row.transfer_id is not None:
                if data.get("category_slug", row.category_slug) != row.category_slug:
                    raise ValueError("A transfer's category can't be changed")
                data.pop("category_slug", None)
                if "amount" in data and not data["amount"]:
                    raise ValueError("Transfer amount must be positive")
                legs = await self._repo.transfer_legs_for_update(actor.household_id, row.transfer_id)

            for leg in legs:
                acc = await self._accounts.get_for_update(actor.household_id, leg.account_id)
                if acc is None:
                    return None
                old_amount = leg.amount
                for k, v in data.items():
                    if k == "amount" and leg.transfer_id is not None:
                        v = -abs(v) if old_amount < 0 else abs(v)
                    setattr(leg, k, v)
                if "amount" in data:
                    acc.balance = Decimal(acc.balance) + (leg.amount - old_amount)
                acc.updated_at = datetime.now(UTC)

            if "plan_item_id" in plan_fields:
                item_id = plan_fields["plan_item_id"]
                if item_id is None:
                    linking.link(row, None, None)
                else:
                    item, month = await linking.resolve_item(
                        self._session, actor.household_id, item_id
                    )
                    linking.link(row, item, month)
            elif "monthly_payment_id" in plan_fields:
                item_id = plan_fields["monthly_payment_id"]
                row.monthly_payment_id = item_id
                row.period_month = (
                    None
                    if item_id is None
                    else await self._plan_period(
                        actor, item_id, plan_fields.get("period_month"), row.occurred_at
                    )
                )
            elif plan_fields.get("period_month") is not None and row.monthly_payment_id:
                row.period_month = month_start(plan_fields["period_month"])

            await self._session.flush()
            await self._session.refresh(row)
            read = self._to_read(row)
            is_transfer = row.transfer_id is not None
            await self._audit.append(
                user_id=actor.user_id,
                action="transfer.update" if is_transfer else "transaction.update",
                entity_type="transfer" if is_transfer else "ledger_transaction",
                entity_id=row.transfer_id if is_transfer else row.id,
                payload={"fields": sorted([*data.keys(), *plan_fields.keys()])},
            )
            return read

    async def delete(self, actor: Actor, tx_id: UUID) -> bool:
        """Delete an entry; deleting either leg of a transfer removes the whole transfer."""
        async with self._session.begin():
            row = await self._repo.get_for_update(actor.household_id, tx_id)
            if row is None:
                return False
            legs = (
                await self._repo.transfer_legs_for_update(actor.household_id, row.transfer_id)
                if row.transfer_id is not None
                else [row]
            )
            for leg in legs:
                acc = await self._accounts.get_for_update(actor.household_id, leg.account_id)
                if acc is None:
                    return False
                acc.balance = Decimal(acc.balance) - leg.amount
                acc.updated_at = datetime.now(UTC)
                await self._repo.soft_delete(leg)
            is_transfer = row.transfer_id is not None
            await self._audit.append(
                user_id=actor.user_id,
                action="transfer.delete" if is_transfer else "transaction.delete",
                entity_type="transfer" if is_transfer else "ledger_transaction",
                entity_id=row.transfer_id if is_transfer else row.id,
                payload={"amount": str(abs(row.amount))},
            )
            return True
