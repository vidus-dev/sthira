from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class CategoryTotal(BaseModel):
    slug: str
    total: Decimal
    count: int


class DayTotal(BaseModel):
    day: date
    expense: Decimal
    income: Decimal


class MemberTotal(BaseModel):
    user_id: UUID
    expense: Decimal


class PreviousMonth(BaseModel):
    year: int
    month: int
    expense_total: Decimal
    # Spending in the previous month up to the same day-of-month as ``as_of_day``,
    # for "₹X less than this point last month".
    expense_to_same_day: Decimal


class MonthSummary(BaseModel):
    """Expenses and income exclude transfers between our own accounts."""

    year: int
    month: int
    currency: str
    days_in_month: int
    as_of_day: int  # today's day for the current month, else the last day
    income_total: Decimal
    expense_total: Decimal
    net: Decimal
    expense_by_category: list[CategoryTotal]
    income_by_category: list[CategoryTotal]
    by_day: list[DayTotal]
    by_member: list[MemberTotal]
    previous: PreviousMonth
