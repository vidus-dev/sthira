"""Month summary (totals, by category, by day, by member, last month's pace), the total
balance day by day, and month-by-month savings."""

import calendar
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor
from app.models.account import FinancialAccount
from app.models.household import Household
from app.models.transaction import LedgerTransaction
from app.modules.households.defaults import ADJUSTMENT_SLUG
from app.modules.month_plans.linking import SALARY_SLUG, salary_window
from app.modules.periods import add_months, local_date, month_bounds, month_start
from app.modules.summary.schemas import (
    BalanceHistory,
    BalancePoint,
    CategoryTotal,
    DayTotal,
    MemberTotal,
    MonthSavings,
    MonthSummary,
    PreviousMonth,
    SavingsHistory,
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

    async def balance_history(self, actor: Actor, days: int) -> BalanceHistory:
        """Rebuilt backwards from today's balances: the end of day D is today's balance
        minus every entry dated after D. Transfers net out across accounts; balance
        corrections count (they moved the balance). An account adds nothing before the
        day it was added, since its opening balance already holds what came before."""
        household = await self._session.get(Household, actor.household_id)
        assert household is not None
        tz = household.timezone
        today = local_date(datetime.now(UTC), tz)

        accounts = (
            await self._session.execute(
                select(
                    FinancialAccount.id, FinancialAccount.balance, FinancialAccount.created_at
                ).where(FinancialAccount.household_id == actor.household_id)
            )
        ).all()
        if not accounts:
            return BalanceHistory(points=[])
        opened = {acc_id: local_date(created, tz) for acc_id, _, created in accounts}
        balance = {acc_id: Decimal(bal) for acc_id, bal, _ in accounts}
        first = min(today, max(today - timedelta(days=days - 1), min(opened.values())))

        local_day = func.date(func.timezone(tz, LedgerTransaction.occurred_at))
        rows = await self._session.execute(
            select(LedgerTransaction.account_id, local_day, func.sum(LedgerTransaction.amount))
            .where(
                LedgerTransaction.household_id == actor.household_id,
                LedgerTransaction.deleted_at.is_(None),
                local_day > first,
            )
            .group_by(LedgerTransaction.account_id, local_day)
        )
        on_day: dict[date, dict[UUID, Decimal]] = defaultdict(dict)
        after: dict[UUID, Decimal] = defaultdict(lambda: ZERO)
        for acc_id, day, total in rows.all():
            if day > today:  # dated in the future: not in any end-of-day yet
                after[acc_id] += total
            else:
                on_day[day][acc_id] = total

        points: list[BalancePoint] = []
        day = today
        while day >= first:
            total = sum((balance[a] - after[a] for a in balance if opened[a] <= day), ZERO)
            points.append(BalancePoint(day=day, total=total))
            for acc_id, amount in on_day.get(day, {}).items():
                after[acc_id] += amount
            day -= timedelta(days=1)
        points.reverse()
        return BalanceHistory(points=points)

    async def savings(self, actor: Actor, count: int) -> SavingsHistory:
        """Income, spending and what was kept, per month. Salary follows the plan's window
        (salary on 30 Sep counts for October), so a month doesn't look empty just because
        the salary landed a day early. Months before the first entry are left out."""
        household = await self._session.get(Household, actor.household_id)
        assert household is not None
        tz = household.timezone
        current = month_start(local_date(datetime.now(UTC), tz))
        months = [add_months(current, -i) for i in range(count - 1, -1, -1)]
        start, _ = month_bounds(months[0].year, months[0].month, tz)
        _, end = month_bounds(current.year, current.month, tz)

        local_month = func.date_trunc("month", func.timezone(tz, LedgerTransaction.occurred_at))
        not_salary = (LedgerTransaction.amount > 0) & (
            LedgerTransaction.category_slug != SALARY_SLUG
        )
        rows = await self._session.execute(
            select(
                local_month,
                func.coalesce(
                    func.sum(case((LedgerTransaction.amount < 0, -LedgerTransaction.amount))), ZERO
                ),
                func.coalesce(func.sum(case((not_salary, LedgerTransaction.amount))), ZERO),
            )
            .where(*self._scope(actor, start, end))
            .group_by(local_month)
        )
        expense: dict[date, Decimal] = {}
        other_income: dict[date, Decimal] = {}
        for m, spent, received in rows.all():
            expense[m.date()] = spent
            other_income[m.date()] = received

        windows = [(m, *salary_window(m, tz)) for m in months]
        salary_rows = await self._session.execute(
            select(LedgerTransaction.occurred_at, LedgerTransaction.amount).where(
                *self._scope(actor, windows[0][1], windows[-1][2]),
                LedgerTransaction.amount > 0,
                LedgerTransaction.category_slug == SALARY_SLUG,
            )
        )
        salary: dict[date, Decimal] = defaultdict(lambda: ZERO)
        for occurred_at, amount in salary_rows.all():
            for m, w_start, w_end in windows:
                if w_start <= occurred_at < w_end:
                    salary[m] += amount
                    break

        out: list[MonthSavings] = []
        for m in months:
            spent = expense.get(m, ZERO)
            income = salary[m] + other_income.get(m, ZERO)
            if not out and not spent and not income and m != current:
                continue  # before the first entry
            out.append(
                MonthSavings(
                    year=m.year,
                    month=m.month,
                    income=income,
                    salary=salary[m],
                    expense=spent,
                    net=income - spent,
                )
            )
        return SavingsHistory(months=out)
