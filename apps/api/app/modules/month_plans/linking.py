"""Connecting entries to lines of a month's plan.

Used by the transaction and transfer services, so it only depends on models (the plan
service depends on those services, not the other way round).
"""

from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.month_plan import MonthPlan, MonthPlanItem
from app.models.transaction import LedgerTransaction
from app.modules.households.defaults import ADJUSTMENT_SLUG
from app.modules.periods import add_months, period_for

SALARY_SLUG = "salary"
CENT = Decimal("0.01")


def salary_window(month: date, tz_name: str) -> tuple[datetime, datetime]:
    """Salary that counts for ``month``: from the last day of the month before up to (not
    including) the last day of this month. Salary on 31 Oct or 1 Nov sets November's %."""
    tz = ZoneInfo(tz_name)
    first = month - timedelta(days=1)
    last_day = add_months(month, 1) - timedelta(days=1)
    return (
        datetime(first.year, first.month, first.day, tzinfo=tz),
        datetime(last_day.year, last_day.month, last_day.day, tzinfo=tz),
    )


async def salary_entries(
    session: AsyncSession, household_id: UUID, month: date, tz_name: str
) -> list[LedgerTransaction]:
    start, end = salary_window(month, tz_name)
    rows = await session.execute(
        select(LedgerTransaction)
        .where(
            LedgerTransaction.household_id == household_id,
            LedgerTransaction.deleted_at.is_(None),
            LedgerTransaction.transfer_id.is_(None),
            LedgerTransaction.amount > 0,
            LedgerTransaction.category_slug == SALARY_SLUG,
            LedgerTransaction.occurred_at >= start,
            LedgerTransaction.occurred_at < end,
        )
        .order_by(LedgerTransaction.occurred_at)
    )
    return list(rows.scalars())


async def resolve_item(
    session: AsyncSession, household_id: UUID, item_id: UUID
) -> tuple[MonthPlanItem, date]:
    """The plan line and the month it belongs to; ValueError if it isn't this household's."""
    row = (
        await session.execute(
            select(MonthPlanItem, MonthPlan.month)
            .join(MonthPlan, MonthPlan.id == MonthPlanItem.plan_id)
            .where(MonthPlanItem.id == item_id, MonthPlanItem.household_id == household_id)
        )
    ).first()
    if row is None:
        raise ValueError("Plan item not found")
    return row[0], row[1]


async def item_for_template(
    session: AsyncSession, household_id: UUID, template_id: UUID, period: date
) -> MonthPlanItem | None:
    """The line a repeating item became in that month's plan, if the plan exists."""
    return await session.scalar(
        select(MonthPlanItem)
        .join(MonthPlan, MonthPlan.id == MonthPlanItem.plan_id)
        .where(
            MonthPlan.household_id == household_id,
            MonthPlan.month == period,
            MonthPlanItem.template_id == template_id,
        )
        .limit(1)
    )


async def paid_on(session: AsyncSession, item_id: UUID) -> Decimal:
    """Money that has gone out against a line (expenses and transfer outgoing legs)."""
    total = await session.scalar(
        select(func.coalesce(func.sum(-LedgerTransaction.amount), 0)).where(
            LedgerTransaction.plan_item_id == item_id,
            LedgerTransaction.deleted_at.is_(None),
            LedgerTransaction.amount < 0,
        )
    )
    return Decimal(total or 0)


async def bill_due(
    session: AsyncSession, household_id: UUID, item: MonthPlanItem, month: date, tz_name: str
) -> Decimal | None:
    if item.amount_type == "percent":
        if item.percent is None:
            return None
        base = sum(
            (t.amount for t in await salary_entries(session, household_id, month, tz_name)),
            Decimal("0"),
        )
        return (
            (base * item.percent / Decimal("100")).quantize(CENT, rounding=ROUND_HALF_UP)
            if base
            else None
        )
    return item.amount


async def auto_link_bill(
    session: AsyncSession, household_id: UUID, tx: LedgerTransaction, tz_name: str
) -> MonthPlanItem | None:
    """Link a new expense to the month's unpaid bill in the same category ("Rent 37,000" →
    October's rent). Only when that month's plan already exists; a plan created later
    links its month's entries itself."""
    if (
        tx.plan_item_id is not None
        or tx.monthly_payment_id is not None
        or tx.transfer_id is not None
        or tx.amount >= 0
        or tx.category_slug in (ADJUSTMENT_SLUG, "uncategorized")
    ):
        return None
    month = period_for(tx.occurred_at, tz_name)
    candidates = (
        await session.execute(
            select(MonthPlanItem)
            .join(MonthPlan, MonthPlan.id == MonthPlanItem.plan_id)
            .where(
                MonthPlan.household_id == household_id,
                MonthPlan.month == month,
                MonthPlanItem.kind == "bill",
                MonthPlanItem.category_slug == tx.category_slug,
                MonthPlanItem.closed.is_(False),
                MonthPlanItem.carried_over.is_(False),
            )
            .order_by(MonthPlanItem.sort_order, MonthPlanItem.created_at)
        )
    ).scalars().all()
    for item in candidates:
        due = await bill_due(session, household_id, item, month, tz_name)
        paid = await paid_on(session, item.id)
        if (due is None and paid == 0) or (due is not None and paid < due):
            link(tx, item, month)
            return item
    return None


def link(tx: LedgerTransaction, item: MonthPlanItem | None, month: date | None) -> None:
    """Point an entry at a plan line (or clear it), keeping the older links in step."""
    if item is None:
        tx.plan_item_id = None
        tx.monthly_payment_id = None
        tx.period_month = None
        return
    tx.plan_item_id = item.id
    tx.monthly_payment_id = item.template_id
    tx.period_month = month
