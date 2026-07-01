"""Pure planning math (no I/O)."""

from datetime import date
from decimal import Decimal


def whole_months_between(start: date, end: date) -> int:
    """Calendar-ish whole months from ``start`` to ``end`` (non-negative)."""
    if end < start:
        return 0
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day < start.day:
        months -= 1
    return max(0, months)


def remaining_to_target(target_amount: Decimal, saved_amount: Decimal) -> Decimal:
    return target_amount - saved_amount


def suggested_monthly_contribution(
    target_amount: Decimal,
    saved_amount: Decimal,
    target_date: date | None,
    *,
    today: date | None = None,
) -> Decimal | None:
    """
    Rupees per month to reach ``target_amount`` by ``target_date``.
    Returns ``None`` if there is no target date (open-ended goal).
    """
    ref = today or date.today()
    left = remaining_to_target(target_amount, saved_amount)
    if left <= 0:
        return Decimal("0")
    if target_date is None:
        return None
    months = whole_months_between(ref, target_date)
    if months <= 0:
        return left.quantize(Decimal("0.01"))
    return (left / Decimal(months)).quantize(Decimal("0.01"))


def progress_ratio(target_amount: Decimal, saved_amount: Decimal) -> Decimal:
    if target_amount <= 0:
        return Decimal("0")
    r = saved_amount / target_amount
    if r > 1:
        return Decimal("1")
    return r.quantize(Decimal("0.0001"))
