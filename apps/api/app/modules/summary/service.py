"""Month summary: totals, by category, by day, by member, and last month's pace."""

import calendar
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor
from app.models.household import Household
from app.models.transaction import LedgerTransaction
from app.modules.households.defaults import ADJUSTMENT_SLUG
from app.modules.periods import add_months, local_date, month_bounds
from app.modules.summary.schemas import (
    CategoryTotal,
    DayTotal,
    MemberTotal,
    MonthSummary,
    PreviousMonth,
)

ZERO = Decimal("0")


class SummaryService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def _scope(self, actor: Actor, start: datetime, end: datetime):
        return (
            LedgerTransaction.household_id == actor.household_id,
            LedgerTransaction.deleted_at.is_(None),
            LedgerTransaction.transfer_id.is_(None),
            # Balance corrections are neither income nor spending.
            LedgerTransaction.category_slug != ADJUSTMENT_SLUG,
            LedgerTransaction.occurred_at >= start,
            LedgerTransaction.occurred_at < end,
        )

    async def _by_day(
        self, actor: Actor, tz: str, start: datetime, end: datetime
    ) -> dict[date, tuple[Decimal, Decimal]]:
        local_day = func.date(func.timezone(tz, LedgerTransaction.occurred_at))
        rows = await self._session.execute(
            select(
                local_day,
                func.coalesce(
                    func.sum(case((LedgerTransaction.amount < 0, -LedgerTransaction.amount))), ZERO
                ),
                func.coalesce(
                    func.sum(case((LedgerTransaction.amount > 0, LedgerTransaction.amount))), ZERO
                ),
            )
            .where(*self._scope(actor, start, end))
            .group_by(local_day)
            .order_by(local_day)
        )
        return {day: (expense, income) for day, expense, income in rows.all()}

    async def _by_category(
        self, actor: Actor, start: datetime, end: datetime, *, income: bool
    ) -> list[CategoryTotal]:
        sign = LedgerTransaction.amount > 0 if income else LedgerTransaction.amount < 0
        total = func.sum(LedgerTransaction.amount if income else -LedgerTransaction.amount)
        rows = await self._session.execute(
            select(LedgerTransaction.category_slug, total, func.count())
            .where(*self._scope(actor, start, end), sign)
            .group_by(LedgerTransaction.category_slug)
            .order_by(total.desc())
        )
        return [CategoryTotal(slug=s, total=t, count=c) for s, t, c in rows.all()]

    async def month(self, actor: Actor, year: int, month: int) -> MonthSummary:
        household = await self._session.get(Household, actor.household_id)
        assert household is not None
        tz = household.timezone
        start, end = month_bounds(year, month, tz)
        days_in_month = calendar.monthrange(year, month)[1]

        today = local_date(datetime.now(UTC), tz)
        if (today.year, today.month) == (year, month):
            as_of_day = today.day
        elif date(year, month, 1) > today:
            as_of_day = 0
        else:
            as_of_day = days_in_month

        days = await self._by_day(actor, tz, start, end)
        expense_total = sum((e for e, _ in days.values()), ZERO)
        income_total = sum((i for _, i in days.values()), ZERO)

        members = await self._session.execute(
            select(LedgerTransaction.user_id, func.sum(-LedgerTransaction.amount))
            .where(*self._scope(actor, start, end), LedgerTransaction.amount < 0)
            .group_by(LedgerTransaction.user_id)
        )

        prev = add_months(date(year, month, 1), -1)
        prev_start, prev_end = month_bounds(prev.year, prev.month, tz)
        prev_days = await self._by_day(actor, tz, prev_start, prev_end)
        cutoff = min(as_of_day, calendar.monthrange(prev.year, prev.month)[1])

        return MonthSummary(
            year=year,
            month=month,
            currency=household.currency,
            days_in_month=days_in_month,
            as_of_day=as_of_day,
            income_total=income_total,
            expense_total=expense_total,
            net=income_total - expense_total,
            expense_by_category=await self._by_category(actor, start, end, income=False),
            income_by_category=await self._by_category(actor, start, end, income=True),
            by_day=[DayTotal(day=d, expense=e, income=i) for d, (e, i) in sorted(days.items())],
            by_member=[MemberTotal(user_id=u, expense=t) for u, t in members.all()],
            previous=PreviousMonth(
                year=prev.year,
                month=prev.month,
                expense_total=sum((e for e, _ in prev_days.values()), ZERO),
                expense_to_same_day=sum(
                    (e for d, (e, _) in prev_days.items() if d.day <= cutoff), ZERO
                ),
            ),
        )
