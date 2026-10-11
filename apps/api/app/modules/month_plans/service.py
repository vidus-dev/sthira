"""Month plans: each month has its own list, built from the repeating items.

- Opening a month for the first time creates its plan: every active repeating item is
  copied ("same every month" keeps its amount, "changes every month" waits for one, "%
  of salary" is worked out from that month's salary) and payments already made that
  month are linked to their lines.
- Bills are paid; allowances are money set aside (often moved to a bucket account) and
  spent through the month, so they show what's left.
"""

from collections import defaultdict
from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor
from app.models.account import FinancialAccount
from app.models.household import Household
from app.models.month_plan import MonthPlan, MonthPlanItem
from app.models.monthly_payment import MonthlyPayment
from app.models.transaction import LedgerTransaction
from app.modules.accounts.repository import AccountRepository
from app.modules.errors import NotFoundError
from app.modules.households.defaults import ADJUSTMENT_SLUG
from app.modules.month_plans import linking
from app.modules.month_plans.schemas import (
    BucketCheck,
    CarryBody,
    LineCreate,
    LinePay,
    LineUpdate,
    MonthPlanRead,
    PlanLine,
    PlanSalary,
    PlanUpdate,
    SalaryEntry,
    UnpaidLine,
)
from app.modules.monthly_payments import calculator
from app.modules.monthly_payments.schemas import DEFAULT_BASE_CATEGORY, check_amounts
from app.modules.periods import add_months, household_timezone, local_date, month_bounds, period_for
from app.modules.transactions.schemas import TransactionCreate, TransactionRead
from app.modules.transactions.service import TransactionService
from app.modules.transfers.schemas import TransferCreate
from app.modules.transfers.service import TransferService

ZERO = Decimal("0")
# Fields a line shares with its repeating item.
_SHARED = (
    "name",
    "category_slug",
    "kind",
    "amount_type",
    "amount",
    "percent",
    "covers_rest",
    "dest_account_id",
    "default_account_id",
    "due_day",
    "notes",
)


def _check_line(amount_type: str, amount: Decimal | None, percent: Decimal | None) -> None:
    # "Changes every month" may be left blank until the bill comes.
    if amount_type != "variable":
        check_amounts(amount_type, amount, percent)


class MonthPlanService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._accounts = AccountRepository(session)

    # --- reading ------------------------------------------------------------------------

    async def get(self, actor: Actor, year: int, month: int) -> MonthPlanRead:
        first = date(year, month, 1)
        plan = await self._ensure(actor, first)
        result = await self._read(actor, first, plan, with_previous=True)
        await self._session.commit()
        return result

    async def _find(self, actor: Actor, month: date) -> MonthPlan | None:
        return await self._session.scalar(
            select(MonthPlan).where(
                MonthPlan.household_id == actor.household_id, MonthPlan.month == month
            )
        )

    async def _ensure(self, actor: Actor, month: date) -> MonthPlan | None:
        """The month's plan, created from the repeating items the first time it's opened.

        None for months before the household existed (shown empty, nothing is stored).
        """
        plan = await self._find(actor, month)
        if plan is not None:
            return plan
        tz = await household_timezone(self._session, actor.household_id)
        this_month = period_for(datetime.now(UTC), tz)
        if month > add_months(this_month, 1):
            raise ValueError("You can plan up to next month")
        created = await self._session.scalar(
            select(Household.created_at).where(Household.id == actor.household_id)
        )
        if created is not None and month < period_for(created, tz):
            return None

        plan = MonthPlan(household_id=actor.household_id, month=month)
        self._session.add(plan)
        try:
            await self._session.flush()
        except IntegrityError:  # opened twice at once: use the other one
            await self._session.rollback()
            found = await self._find(actor, month)
            assert found is not None
            return found

        templates = (
            await self._session.execute(
                select(MonthlyPayment)
                .where(
                    MonthlyPayment.household_id == actor.household_id,
                    MonthlyPayment.is_active.is_(True),
                )
                .order_by(MonthlyPayment.sort_order, MonthlyPayment.created_at)
            )
        ).scalars().all()
        lines = [self._line_from_template(plan, t, i) for i, t in enumerate(templates)]
        self._session.add_all(lines)
        await self._session.flush()
        await self._link_existing(actor, plan, lines, tz)
        await self._session.commit()
        return plan

    @staticmethod
    def _line_from_template(plan: MonthPlan, t: MonthlyPayment, order: int) -> MonthPlanItem:
        return MonthPlanItem(
            plan_id=plan.id,
            household_id=plan.household_id,
            template_id=t.id,
            name=t.name,
            category_slug=t.category_slug,
            kind=t.kind or "bill",
            amount_type=t.amount_type,
            # "Changes every month" starts blank; its last amount is shown as a hint.
            amount=t.amount if t.amount_type == "fixed" else None,
            percent=t.percent,
            covers_rest=t.covers_rest,
            dest_account_id=t.dest_account_id,
            default_account_id=t.default_account_id,
            due_day=t.due_day,
            sort_order=order,
            notes=t.notes,
        )

    async def _link_existing(
        self, actor: Actor, plan: MonthPlan, lines: list[MonthPlanItem], tz: str
    ) -> None:
        """Payments made this month before the plan existed: by repeating item first, then
        unlinked expenses by category (rent paid on the 1st, plan written on the 5th)."""
        for line in lines:
            if line.template_id is None:
                continue
            await self._session.execute(
                update(LedgerTransaction)
                .where(
                    LedgerTransaction.household_id == actor.household_id,
                    LedgerTransaction.monthly_payment_id == line.template_id,
                    LedgerTransaction.period_month == plan.month,
                    LedgerTransaction.plan_item_id.is_(None),
                )
                .values(plan_item_id=line.id)
            )
        start, end = month_bounds(plan.month.year, plan.month.month, tz)
        loose = (
            await self._session.execute(
                select(LedgerTransaction)
                .where(
                    LedgerTransaction.household_id == actor.household_id,
                    LedgerTransaction.deleted_at.is_(None),
                    LedgerTransaction.plan_item_id.is_(None),
                    LedgerTransaction.monthly_payment_id.is_(None),
                    LedgerTransaction.transfer_id.is_(None),
                    LedgerTransaction.amount < 0,
                    LedgerTransaction.category_slug.in_(
                        {line.category_slug for line in lines if line.kind == "bill"}
                    ),
                    LedgerTransaction.occurred_at >= start,
                    LedgerTransaction.occurred_at < end,
                )
                .order_by(LedgerTransaction.occurred_at)
            )
        ).scalars().all()
        await self._session.flush()
        for tx in loose:
            await linking.auto_link_bill(self._session, actor.household_id, tx, tz)
            await self._session.flush()

    async def _read(
        self, actor: Actor, month: date, plan: MonthPlan | None, *, with_previous: bool
    ) -> MonthPlanRead:
        hid = actor.household_id
        tz = await household_timezone(self._session, hid)
        start, end = month_bounds(month.year, month.month, tz)

        lines: list[MonthPlanItem] = []
        if plan is not None:
            lines = list(
                (
                    await self._session.execute(
                        select(MonthPlanItem)
                        .where(MonthPlanItem.plan_id == plan.id)
                        .order_by(MonthPlanItem.sort_order, MonthPlanItem.created_at)
                    )
                ).scalars()
            )
        ids = [line.id for line in lines]

        # Salary for the % items.
        entries = await linking.salary_entries(self._session, hid, month, tz)
        auto = sum((t.amount for t in entries), ZERO)
        override = plan.salary_override if plan is not None else None
        base = override if override is not None else auto
        salary = PlanSalary(
            auto=auto,
            override=override,
            effective=base,
            entries=[SalaryEntry(date=local_date(t.occurred_at, tz), amount=t.amount) for t in entries],
        )

        # Payments linked to lines (expenses and transfers' outgoing legs).
        linked: dict[UUID, list[LedgerTransaction]] = defaultdict(list)
        if ids:
            rows = await self._session.execute(
                select(LedgerTransaction)
                .where(
                    LedgerTransaction.plan_item_id.in_(ids),
                    LedgerTransaction.deleted_at.is_(None),
                )
                .order_by(LedgerTransaction.occurred_at)
            )
            for tx in rows.scalars():
                linked[tx.plan_item_id].append(tx)

        bill_ids = {line.id for line in lines if line.kind == "bill"}
        spent_by_category = await self._spending(hid, start, end, bill_ids)
        pool = await self._unlinked_inflows(hid, start, end, {line.dest_account_id for line in lines if line.dest_account_id})
        last_amounts = await self._last_month_amounts(hid, month, lines)
        active_templates = await self._active_templates(hid, lines)

        plan_categories = {line.category_slug for line in lines if not line.covers_rest}
        out: list[PlanLine] = []
        for line in lines:
            payments = linked.get(line.id, [])
            paid = sum((-t.amount for t in payments if t.amount < 0), ZERO)
            if line.amount_type == "percent":
                due = calculator.due_amount("percent", None, line.percent, base) if base else None
            else:
                due = line.amount
            if line.dest_account_id and due is not None and paid < due and not line.closed:
                # A transfer into the bucket made without the Pay button still counts.
                take = min(pool[line.dest_account_id], due - paid)
                pool[line.dest_account_id] -= take
                paid += take

            spent = left = None
            if line.kind == "allowance":
                if line.covers_rest:
                    spent = sum(
                        (v for slug, v in spent_by_category.items() if slug not in plan_categories),
                        ZERO,
                    )
                else:
                    spent = spent_by_category.get(line.category_slug, ZERO)
                left = due - spent if due is not None else None

            status = self._status(line, due, paid, base)
            out.append(
                PlanLine(
                    id=line.id,
                    template_id=line.template_id,
                    repeats=line.template_id in active_templates,
                    name=line.name,
                    category_slug=line.category_slug,
                    kind=line.kind,
                    amount_type=line.amount_type,
                    amount=line.amount,
                    percent=line.percent,
                    covers_rest=line.covers_rest,
                    dest_account_id=line.dest_account_id,
                    default_account_id=line.default_account_id,
                    due_day=line.due_day,
                    due_date=calculator.due_date(month.year, month.month, line.due_day),
                    sort_order=line.sort_order,
                    closed=line.closed,
                    carried_from_id=line.carried_from_id,
                    notes=line.notes,
                    status=status,
                    due_amount=due,
                    paid_amount=paid,
                    remaining=calculator.remaining(due, paid) if status != "paid" else ZERO,
                    spent_amount=spent,
                    left_amount=left,
                    last_month_amount=last_amounts.get(line.template_id) if line.template_id else None,
                    payments=[TransactionRead.model_validate(t) for t in payments],
                )
            )

        actionable = [p for p in out if p.status != "tracking"]
        return MonthPlanRead(
            year=month.year,
            month=month.month,
            exists=plan is not None,
            reviewed=plan is not None and plan.reviewed_at is not None,
            salary=salary,
            items=out,
            planned_total=sum((p.due_amount or ZERO for p in out), ZERO),
            done_total=sum(
                (min(p.paid_amount, p.due_amount or p.paid_amount) for p in actionable), ZERO
            ),
            settled_count=sum(1 for p in actionable if p.status == "paid"),
            total_count=len(actionable),
            needs_amount_count=sum(1 for p in out if p.status == "needs_amount"),
            buckets=await self._buckets(hid, out),
            previous_unpaid=await self._previous_unpaid(actor, month) if with_previous else [],
        )

    @staticmethod
    def _status(line: MonthPlanItem, due: Decimal | None, paid: Decimal, base: Decimal) -> str:
        if line.closed:
            return "paid"
        if line.kind == "allowance" and line.dest_account_id is None:
            # Nothing to pay or move: just watch what's left.
            if line.amount_type == "variable" and due is None:
                return "needs_amount"
            if line.amount_type == "percent" and not base:
                return "awaiting_income"
            return "tracking"
        if due is not None and paid >= due and due > 0:
            return "paid"
        if due is None and paid > 0 and line.amount_type == "variable":
            return "paid"
        if paid > 0:
            return "partial"
        if line.amount_type == "percent" and not base:
            return "awaiting_income"
        if due is None:
            return "needs_amount"
        return "due"

    async def _spending(
        self, hid: UUID, start: datetime, end: datetime, bill_ids: set[UUID]
    ) -> dict[str, Decimal]:
        """Everyday spending per category this month (bill payments left out)."""
        q = (
            select(LedgerTransaction.category_slug, func.sum(-LedgerTransaction.amount))
            .where(
                LedgerTransaction.household_id == hid,
                LedgerTransaction.deleted_at.is_(None),
                LedgerTransaction.transfer_id.is_(None),
                LedgerTransaction.amount < 0,
                LedgerTransaction.category_slug != ADJUSTMENT_SLUG,
                LedgerTransaction.occurred_at >= start,
                LedgerTransaction.occurred_at < end,
            )
            .group_by(LedgerTransaction.category_slug)
        )
        if bill_ids:
            q = q.where(
                (LedgerTransaction.plan_item_id.is_(None))
                | (LedgerTransaction.plan_item_id.not_in(bill_ids))
            )
        return {slug: Decimal(total) for slug, total in (await self._session.execute(q)).all()}

    async def _unlinked_inflows(
        self, hid: UUID, start: datetime, end: datetime, accounts: set[UUID]
    ) -> dict[UUID, Decimal]:
        """Money moved into bucket accounts this month without using a line's Pay button."""
        pool: dict[UUID, Decimal] = defaultdict(lambda: ZERO)
        if not accounts:
            return pool
        linked_transfers = (
            select(LedgerTransaction.transfer_id)
            .where(
                LedgerTransaction.household_id == hid,
                LedgerTransaction.transfer_id.is_not(None),
                LedgerTransaction.plan_item_id.is_not(None),
            )
            .scalar_subquery()
        )
        rows = await self._session.execute(
            select(LedgerTransaction.account_id, func.sum(LedgerTransaction.amount))
            .where(
                LedgerTransaction.household_id == hid,
                LedgerTransaction.deleted_at.is_(None),
                LedgerTransaction.transfer_id.is_not(None),
                LedgerTransaction.amount > 0,
                LedgerTransaction.account_id.in_(accounts),
                LedgerTransaction.occurred_at >= start,
                LedgerTransaction.occurred_at < end,
                LedgerTransaction.transfer_id.not_in(linked_transfers),
            )
            .group_by(LedgerTransaction.account_id)
        )
        for account_id, total in rows.all():
            pool[account_id] = Decimal(total)
        return pool

    async def _last_month_amounts(
        self, hid: UUID, month: date, lines: list[MonthPlanItem]
    ) -> dict[UUID, Decimal]:
        """Last month's amount per repeating item (what was set, else what was paid)."""
        template_ids = {line.template_id for line in lines if line.template_id}
        if not template_ids:
            return {}
        prev = add_months(month, -1)
        rows = (
            await self._session.execute(
                select(MonthPlanItem.id, MonthPlanItem.template_id, MonthPlanItem.amount)
                .join(MonthPlan, MonthPlan.id == MonthPlanItem.plan_id)
                .where(
                    MonthPlan.household_id == hid,
                    MonthPlan.month == prev,
                    MonthPlanItem.template_id.in_(template_ids),
                )
            )
        ).all()
        out: dict[UUID, Decimal] = {}
        for item_id, template_id, amount in rows:
            value = amount if amount is not None else await linking.paid_on(self._session, item_id)
            if value:
                out[template_id] = value
        # No earlier month yet: the repeating item's usual amount is still a useful hint.
        missing = template_ids - out.keys()
        if missing:
            estimates = await self._session.execute(
                select(MonthlyPayment.id, MonthlyPayment.amount).where(
                    MonthlyPayment.id.in_(missing), MonthlyPayment.amount.is_not(None)
                )
            )
            out.update({tid: amount for tid, amount in estimates.all()})
        return out

    async def _active_templates(self, hid: UUID, lines: list[MonthPlanItem]) -> set[UUID]:
        ids = {line.template_id for line in lines if line.template_id}
        if not ids:
            return set()
        rows = await self._session.execute(
            select(MonthlyPayment.id).where(
                MonthlyPayment.household_id == hid,
                MonthlyPayment.id.in_(ids),
                MonthlyPayment.is_active.is_(True),
            )
        )
        return set(rows.scalars())

    async def _buckets(self, hid: UUID, lines: list[PlanLine]) -> list[BucketCheck]:
        """For each bucket account: money set aside there and not spent yet, vs its balance."""
        reserved: dict[UUID, Decimal] = defaultdict(lambda: ZERO)
        for p in lines:
            if p.kind != "allowance" or not p.dest_account_id or p.due_amount is None:
                continue
            reserved[p.dest_account_id] += max(ZERO, min(p.paid_amount, p.due_amount) - (p.spent_amount or ZERO))
        if not reserved:
            return []
        balances = dict(
            (
                await self._session.execute(
                    select(FinancialAccount.id, FinancialAccount.balance).where(
                        FinancialAccount.household_id == hid,
                        FinancialAccount.id.in_(reserved.keys()),
                    )
                )
            ).all()
        )
        return [
            BucketCheck(
                account_id=acc,
                balance=Decimal(balances[acc]),
                reserved=amount,
                short=max(ZERO, amount - Decimal(balances[acc])),
            )
            for acc, amount in reserved.items()
            if acc in balances and amount > 0
        ]

    async def _previous_unpaid(self, actor: Actor, month: date) -> list[UnpaidLine]:
        prev_month = add_months(month, -1)
        prev = await self._find(actor, prev_month)
        if prev is None:
            return []
        read = await self._read(actor, prev_month, prev, with_previous=False)
        carried = {
            row
            for row in (
                await self._session.execute(
                    select(MonthPlanItem.id).where(
                        MonthPlanItem.plan_id == prev.id, MonthPlanItem.carried_over.is_(True)
                    )
                )
            ).scalars()
        }
        return [
            UnpaidLine(item_id=p.id, name=p.name, remaining=p.remaining)
            for p in read.items
            if p.kind == "bill"
            and p.id not in carried
            and p.status in ("due", "partial")
            and p.remaining
        ]

    # --- changing a month ---------------------------------------------------------------

    async def _plan_or_404(self, actor: Actor, year: int, month: int) -> MonthPlan:
        plan = await self._ensure(actor, date(year, month, 1))
        if plan is None:
            raise ValueError("That month is before you started using Sthira")
        return plan

    async def _line(self, plan: MonthPlan, item_id: UUID) -> MonthPlanItem:
        line = await self._session.scalar(
            select(MonthPlanItem).where(MonthPlanItem.id == item_id, MonthPlanItem.plan_id == plan.id)
        )
        if line is None:
            raise NotFoundError("Plan item not found")
        return line

    async def _check_accounts(self, actor: Actor, *ids: UUID | None) -> None:
        for account_id in ids:
            if account_id is not None and await self._accounts.get(actor.household_id, account_id) is None:
                raise ValueError("Account not found")

    async def _done(self, actor: Actor, plan: MonthPlan) -> MonthPlanRead:
        await self._session.commit()
        result = await self._read(actor, plan.month, plan, with_previous=True)
        await self._session.commit()
        return result

    async def update_plan(self, actor: Actor, year: int, month: int, body: PlanUpdate) -> MonthPlanRead:
        plan = await self._plan_or_404(actor, year, month)
        data = body.model_dump(exclude_unset=True)
        if "salary_override" in data:
            plan.salary_override = data["salary_override"]
        if data.get("reviewed") is not None:
            plan.reviewed_at = datetime.now(UTC) if data["reviewed"] else None
        return await self._done(actor, plan)

    async def _later_lines(self, actor: Actor, plan: MonthPlan, template_id: UUID) -> list[MonthPlanItem]:
        """The same repeating item in plans after this month that have no payments yet."""
        rows = (
            await self._session.execute(
                select(MonthPlanItem)
                .join(MonthPlan, MonthPlan.id == MonthPlanItem.plan_id)
                .where(
                    MonthPlan.household_id == actor.household_id,
                    MonthPlan.month > plan.month,
                    MonthPlanItem.template_id == template_id,
                )
            )
        ).scalars().all()
        out = []
        for line in rows:
            if await linking.paid_on(self._session, line.id) == 0:
                out.append(line)
        return out

    def _template_from(self, actor: Actor, line: MonthPlanItem) -> MonthlyPayment:
        return MonthlyPayment(
            household_id=actor.household_id,
            created_by_user_id=actor.user_id,
            name=line.name,
            category_slug=line.category_slug,
            amount_type=line.amount_type,
            amount=line.amount if line.amount_type == "fixed" else None,
            percent=line.percent,
            base_category_slug=DEFAULT_BASE_CATEGORY if line.amount_type == "percent" else None,
            default_account_id=line.default_account_id,
            dest_account_id=line.dest_account_id,
            kind=line.kind,
            covers_rest=line.covers_rest,
            due_day=line.due_day,
            sort_order=line.sort_order,
            notes=line.notes,
        )

    async def add_line(self, actor: Actor, year: int, month: int, body: LineCreate) -> MonthPlanRead:
        plan = await self._plan_or_404(actor, year, month)
        await self._check_accounts(actor, body.dest_account_id, body.default_account_id)
        _check_line(body.amount_type, body.amount, body.percent)
        next_sort = await self._session.scalar(
            select(func.coalesce(func.max(MonthPlanItem.sort_order), -1) + 1).where(
                MonthPlanItem.plan_id == plan.id
            )
        )
        line = MonthPlanItem(
            plan_id=plan.id,
            household_id=actor.household_id,
            sort_order=next_sort,
            **{k: getattr(body, k) for k in _SHARED},
        )
        if line.covers_rest is None:
            line.covers_rest = False
        self._session.add(line)
        if body.repeat:
            template = self._template_from(actor, line)
            self._session.add(template)
            await self._session.flush()
            line.template_id = template.id
            # Next month's plan may already be open.
            later = (
                await self._session.execute(
                    select(MonthPlan).where(
                        MonthPlan.household_id == actor.household_id, MonthPlan.month > plan.month
                    )
                )
            ).scalars().all()
            for p in later:
                self._session.add(self._line_from_template(p, template, line.sort_order))
        return await self._done(actor, plan)

    async def update_line(
        self, actor: Actor, year: int, month: int, item_id: UUID, body: LineUpdate
    ) -> MonthPlanRead:
        plan = await self._plan_or_404(actor, year, month)
        line = await self._line(plan, item_id)
        data = body.model_dump(exclude_unset=True, exclude={"scope", "repeat"})
        await self._check_accounts(actor, data.get("dest_account_id"), data.get("default_account_id"))
        for key, value in data.items():
            setattr(line, key, value)
        if line.amount_type == "percent":
            line.amount = None
        _check_line(line.amount_type, line.amount, line.percent)
        line.updated_at = datetime.now(UTC)

        template = (
            await self._session.get(MonthlyPayment, line.template_id) if line.template_id else None
        )
        if body.repeat is True and (template is None or not template.is_active):
            if template is None:
                template = self._template_from(actor, line)
                self._session.add(template)
                await self._session.flush()
                line.template_id = template.id
            template.is_active = True
        if body.scope == "future" and template is not None:
            for key in data:
                value = getattr(line, key)
                if key == "amount" and line.amount_type != "fixed":
                    value = None  # the month's own amount, not a rule
                setattr(template, key, value)
            if line.amount_type == "percent" and not template.base_category_slug:
                template.base_category_slug = DEFAULT_BASE_CATEGORY
            template.updated_at = datetime.now(UTC)
            for later in await self._later_lines(actor, plan, template.id):
                for key in data:
                    setattr(later, key, getattr(template, key))
                later.amount = template.amount if template.amount_type == "fixed" else later.amount
        if body.repeat is False and template is not None and template.is_active:
            template.is_active = False
            for later in await self._later_lines(actor, plan, template.id):
                await self._session.delete(later)
        return await self._done(actor, plan)

    async def delete_line(
        self, actor: Actor, year: int, month: int, item_id: UUID, also_future: bool
    ) -> MonthPlanRead:
        plan = await self._plan_or_404(actor, year, month)
        line = await self._line(plan, item_id)
        await self._session.execute(
            update(LedgerTransaction)
            .where(LedgerTransaction.plan_item_id == line.id)
            .values(plan_item_id=None, monthly_payment_id=None, period_month=None)
        )
        if also_future and line.template_id:
            template = await self._session.get(MonthlyPayment, line.template_id)
            if template is not None:
                template.is_active = False
                for later in await self._later_lines(actor, plan, template.id):
                    await self._session.delete(later)
        await self._session.delete(line)
        return await self._done(actor, plan)

    async def close_line(
        self, actor: Actor, year: int, month: int, item_id: UUID, closed: bool
    ) -> MonthPlanRead:
        plan = await self._plan_or_404(actor, year, month)
        line = await self._line(plan, item_id)
        line.closed = closed
        line.updated_at = datetime.now(UTC)
        return await self._done(actor, plan)

    async def pay_line(
        self, actor: Actor, year: int, month: int, item_id: UUID, body: LinePay
    ) -> MonthPlanRead:
        plan = await self._plan_or_404(actor, year, month)
        line = await self._line(plan, item_id)
        move = body.move if body.move is not None else line.dest_account_id is not None
        account_id = body.account_id or line.default_account_id
        if account_id is None:
            raise ValueError("Choose the account it's paid from")
        if move and line.dest_account_id is None:
            raise ValueError("Choose the account to move the money to")
        if move and line.dest_account_id == account_id:
            raise ValueError("Pick a different account to move the money from")

        amount = body.amount
        if amount is None:
            current = await self._read(actor, plan.month, plan, with_previous=False)
            amount = next((p.remaining for p in current.items if p.id == line.id), None)
            if not amount:
                raise ValueError("Enter the amount")
        occurred_at = body.occurred_at or datetime.now(UTC)
        description = body.description or line.name
        line_id, category, dest = line.id, line.category_slug, line.dest_account_id
        await self._session.commit()  # the ledger services open their own transaction

        if move:
            await TransferService(self._session).create(
                actor,
                TransferCreate(
                    source_account_id=account_id,
                    dest_account_id=dest,
                    amount=amount,
                    description=description,
                    occurred_at=occurred_at,
                    plan_item_id=line_id,
                ),
            )
        else:
            await TransactionService(self._session).create(
                actor,
                TransactionCreate(
                    account_id=account_id,
                    amount=-amount,
                    description=description,
                    category_slug=category,
                    occurred_at=occurred_at,
                    plan_item_id=line_id,
                ),
            )
        return await self._read_committed(actor, plan.month)

    async def _read_committed(self, actor: Actor, month: date) -> MonthPlanRead:
        plan = await self._find(actor, month)
        result = await self._read(actor, month, plan, with_previous=True)
        await self._session.commit()
        return result

    async def carry(self, actor: Actor, year: int, month: int, body: CarryBody) -> MonthPlanRead:
        plan = await self._plan_or_404(actor, year, month)
        prev = await self._find(actor, add_months(plan.month, -1))
        if prev is None:
            raise NotFoundError("Last month has no plan")
        old = await self._line(prev, body.item_id)
        if body.action == "done":
            old.closed = True
        else:
            unpaid = next(
                (u for u in await self._previous_unpaid(actor, plan.month) if u.item_id == old.id),
                None,
            )
            if unpaid is None:
                raise ValueError("Nothing left to pay on that item")
            old.carried_over = True
            self._session.add(
                MonthPlanItem(
                    plan_id=plan.id,
                    household_id=actor.household_id,
                    name=f"{old.name} ({prev.month.strftime('%b')})",
                    category_slug=old.category_slug,
                    kind="bill",
                    amount_type="fixed",
                    amount=unpaid.remaining,
                    default_account_id=old.default_account_id,
                    dest_account_id=old.dest_account_id,
                    due_day=plan.month.day,
                    sort_order=-1,
                    carried_from_id=old.id,
                )
            )
        old.updated_at = datetime.now(UTC)
        return await self._done(actor, plan)
