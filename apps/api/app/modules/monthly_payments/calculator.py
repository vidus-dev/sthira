"""Pure rules for what a plan item owes in a month and how settled it is."""

import calendar
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from app.modules.monthly_payments.schemas import PlanStatus

CENT = Decimal("0.01")


def due_amount(
    amount_type: str,
    amount: Decimal | None,
    percent: Decimal | None,
    base_amount: Decimal | None,
) -> Decimal | None:
    if amount_type == "fixed":
        return amount
    if amount_type == "percent":
        if percent is None:
            return None
        base = base_amount or Decimal("0")
        return (base * percent / Decimal("100")).quantize(CENT, rounding=ROUND_HALF_UP)
    return amount  # variable: optional estimate


def plan_status(
    amount_type: str, due: Decimal | None, paid: Decimal, base_amount: Decimal | None
) -> PlanStatus:
    if paid > 0 and (due is None or paid >= due or amount_type == "variable"):
        return "paid"
    if paid > 0:
        return "partial"
    if amount_type == "percent" and not base_amount:
        return "awaiting_income"
    return "due"


def remaining(due: Decimal | None, paid: Decimal) -> Decimal | None:
    if due is None:
        return None
    return max(due - paid, Decimal("0"))


def due_date(year: int, month: int, due_day: int | None) -> date | None:
    """The due day in that month, clamped to its last day (31 → 30 Nov, 28/29 Feb)."""
    if due_day is None:
        return None
    last = calendar.monthrange(year, month)[1]
    return date(year, month, min(due_day, last))
