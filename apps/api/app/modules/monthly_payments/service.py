"""Monthly plan use-cases: manage items, compute a month's status, pay an item."""

from collections import defaultdict
from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor
from app.models.monthly_payment import MonthlyPayment
from app.models.transaction import LedgerTransaction
from app.modules.accounts.repository import AccountRepository
from app.modules.errors import NotFoundError
from app.modules.monthly_payments import calculator
from app.modules.monthly_payments.schemas import (
    DEFAULT_BASE_CATEGORY,
    MonthlyPaymentCreate,
    MonthlyPaymentRead,
    MonthlyPaymentUpdate,
    MonthlyPlanStatus,
    PayRequest,
    PlanItemStatus,
    check_amounts,
)
from app.modules.periods import household_timezone, month_bounds
from app.modules.transactions.schemas import TransactionCreate, TransactionRead
from app.modules.transactions.service import TransactionService
from app.modules.transfers.schemas import TransferCreate
from app.modules.transfers.service import TransferService


class MonthlyPaymentService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._accounts = AccountRepository(session)

    async def _get(self, actor: Actor, item_id: UUID) -> MonthlyPayment | None:
        return await self._session.scalar(
            select(MonthlyPayment).where(
                MonthlyPayment.id == item_id, MonthlyPayment.household_id == actor.household_id
            )
        )

    async def _check_account(self, actor: Actor, account_id: UUID | None) -> None:
        if account_id is not None and await self._accounts.get(actor.household_id, account_id) is None:
            raise ValueError("Account not found")

    # --- items --------------------------------------------------------------------------

    async def list_items(self, actor: Actor, include_inactive: bool = False) -> list[MonthlyPaymentRead]:
        q = select(MonthlyPayment).where(MonthlyPayment.household_id == actor.household_id)
        if not include_inactive:
            q = q.where(MonthlyPayment.is_active.is_(True))
        q = q.order_by(MonthlyPayment.sort_order, MonthlyPayment.created_at)
        rows = (await self._session.execute(q)).scalars().all()
        return [MonthlyPaymentRead.model_validate(r) for r in rows]

    async def create(self, actor: Actor, body: MonthlyPaymentCreate) -> MonthlyPaymentRead:
        await self._check_account(actor, body.default_account_id)
        sort_order = body.sort_order
        if sort_order is None:
            sort_order = await self._session.scalar(
                select(func.coalesce(func.max(MonthlyPayment.sort_order), -1) + 1).where(
                    MonthlyPayment.household_id == actor.household_id
                )
            )
        row = MonthlyPayment(
            household_id=actor.household_id,
            created_by_user_id=actor.user_id,
            name=body.name.strip(),
            category_slug=body.category_slug,
            amount_type=body.amount_type,
            amount=body.amount,
            percent=body.percent,
            base_category_slug=body.base_category_slug,
            default_account_id=body.default_account_id,
            due_day=body.due_day,
            sort_order=sort_order,
            notes=body.notes,
        )
        self._session.add(row)
        await self._session.commit()
        await self._session.refresh(row)
        return MonthlyPaymentRead.model_validate(row)

    async def update(
        self, actor: Actor, item_id: UUID, body: MonthlyPaymentUpdate
    ) -> MonthlyPaymentRead | None:
        row = await self._get(actor, item_id)
        if row is None:
            return None
        data = body.model_dump(exclude_unset=True)
        if "default_account_id" in data:
            await self._check_account(actor, data["default_account_id"])
        for key, value in data.items():
            setattr(row, key, value)
        check_amounts(row.amount_type, row.amount, row.percent)
        if row.amount_type == "percent" and not row.base_category_slug:
            row.base_category_slug = DEFAULT_BASE_CATEGORY
        row.updated_at = datetime.now(UTC)
        await self._session.commit()
        await self._session.refresh(row)
        return MonthlyPaymentRead.model_validate(row)

    async def archive(self, actor: Actor, item_id: UUID) -> bool:
        """Stop tracking from now on; past payments stay linked."""
        row = await self._get(actor, item_id)
        if row is None:
            return False
        row.is_active = False
        row.updated_at = datetime.now(UTC)
        await self._session.commit()
        return True

    # --- status -------------------------------------------------------------------------

    async def status(self, actor: Actor, year: int, month: int) -> MonthlyPlanStatus:
        period = date(year, month, 1)
        tz = await household_timezone(self._session, actor.household_id)
        start, end = month_bounds(year, month, tz)

        payments = (
            await self._session.execute(
                select(LedgerTransaction)
                .where(
                    LedgerTransaction.household_id == actor.household_id,
                    LedgerTransaction.deleted_at.is_(None),
                    LedgerTransaction.period_month == period,
                    LedgerTransaction.monthly_payment_id.is_not(None),
                )
                .order_by(LedgerTransaction.occurred_at)
            )
        ).scalars().all()
        by_item: dict[UUID, list[LedgerTransaction]] = defaultdict(list)
        for tx in payments:
            by_item[tx.monthly_payment_id].append(tx)

        # Active items, plus archived ones that still have a payment in this month.
        items = (
            await self._session.execute(
                select(MonthlyPayment)
                .where(
                    MonthlyPayment.household_id == actor.household_id,
                    or_(MonthlyPayment.is_active.is_(True), MonthlyPayment.id.in_(by_item.keys())),
                )
                .order_by(MonthlyPayment.sort_order, MonthlyPayment.created_at)
            )
        ).scalars().all()

        base_income = await self._income_by_category(
            actor,
            {i.base_category_slug for i in items if i.amount_type == "percent" and i.base_category_slug},
            start,
            end,
        )

        statuses: list[PlanItemStatus] = []
        for item in items:
            base = base_income.get(item.base_category_slug) if item.amount_type == "percent" else None
            due = calculator.due_amount(item.amount_type, item.amount, item.percent, base)
            linked = by_item.get(item.id, [])
            paid = sum((-tx.amount for tx in linked), Decimal("0"))
            statuses.append(
                PlanItemStatus(
                    item=MonthlyPaymentRead.model_validate(item),
                    status=calculator.plan_status(item.amount_type, due, paid, base),
                    due_amount=due,
                    base_amount=base,
                    paid_amount=paid,
                    remaining=calculator.remaining(due, paid),
                    due_date=calculator.due_date(year, month, item.due_day),
                    payments=[TransactionRead.model_validate(tx) for tx in linked],
                )
            )

        return MonthlyPlanStatus(
            year=year,
            month=month,
            items=statuses,
            planned_total=sum((max(s.due_amount or 0, s.paid_amount) for s in statuses), Decimal("0")),
            paid_total=sum((s.paid_amount for s in statuses), Decimal("0")),
            settled_count=sum(1 for s in statuses if s.status == "paid"),
            total_count=len(statuses),
            base_income=base_income,
        )

    async def _income_by_category(
        self, actor: Actor, slugs: set[str], start: datetime, end: datetime
    ) -> dict[str, Decimal]:
        if not slugs:
            return {}
        rows = await self._session.execute(
            select(LedgerTransaction.category_slug, func.sum(LedgerTransaction.amount))
            .where(
                LedgerTransaction.household_id == actor.household_id,
                LedgerTransaction.deleted_at.is_(None),
                LedgerTransaction.transfer_id.is_(None),
                LedgerTransaction.amount > 0,
                LedgerTransaction.category_slug.in_(slugs),
                LedgerTransaction.occurred_at >= start,
                LedgerTransaction.occurred_at < end,
            )
            .group_by(LedgerTransaction.category_slug)
        )
        totals = {slug: Decimal("0") for slug in slugs}
        totals.update({slug: total for slug, total in rows.all()})
        return totals

    # --- pay ----------------------------------------------------------------------------

    async def pay(self, actor: Actor, item_id: UUID, body: PayRequest) -> PlanItemStatus:
        item = await self._get(actor, item_id)
        if item is None:
            raise NotFoundError("Monthly plan item not found")

        amount = body.amount
        if amount is None:
            current = await self._item_status(actor, item.id, body.year, body.month)
            amount = current.remaining
            if not amount:
                raise ValueError("Enter the amount to pay")
        period = date(body.year, body.month, 1)
        occurred_at = body.occurred_at or datetime.now(UTC)
        description = body.description or item.name
        category_slug = item.category_slug
        # Close the read transaction; the ledger services open their own.
        await self._session.commit()

        if body.dest_account_id is not None:
            await TransferService(self._session).create(
                actor,
                TransferCreate(
                    source_account_id=body.account_id,
                    dest_account_id=body.dest_account_id,
                    amount=amount,
                    description=description,
                    occurred_at=occurred_at,
                    monthly_payment_id=item_id,
                    period_month=period,
                ),
            )
        else:
            await TransactionService(self._session).create(
                actor,
                TransactionCreate(
                    account_id=body.account_id,
                    amount=-amount,
                    description=description,
                    category_slug=category_slug,
                    occurred_at=occurred_at,
                    monthly_payment_id=item_id,
                    period_month=period,
                ),
            )
        return await self._item_status(actor, item_id, body.year, body.month)

    async def _item_status(self, actor: Actor, item_id: UUID, year: int, month: int) -> PlanItemStatus:
        plan = await self.status(actor, year, month)
        for s in plan.items:
            if s.item.id == item_id:
                return s
        raise NotFoundError("Monthly plan item not found")
