"""Calendar months in a household's timezone.

Months are what the app reports on ("October"), so their boundaries are computed in
the household's timezone (India by default), not UTC.
"""

from datetime import UTC, date, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.household import Household


def month_start(d: date) -> date:
    return d.replace(day=1)


def add_months(d: date, months: int) -> date:
    """First day of the month ``months`` after ``d``'s month (negative goes back)."""
    index = d.year * 12 + (d.month - 1) + months
    return date(index // 12, index % 12 + 1, 1)


def month_bounds(year: int, month: int, tz_name: str) -> tuple[datetime, datetime]:
    """``[start, end)`` of a calendar month in ``tz_name``, as aware datetimes."""
    tz = ZoneInfo(tz_name)
    first = date(year, month, 1)
    nxt = add_months(first, 1)
    start = datetime(first.year, first.month, 1, tzinfo=tz)
    end = datetime(nxt.year, nxt.month, 1, tzinfo=tz)
    return start, end


def local_date(dt: datetime, tz_name: str) -> date:
    """The calendar date of ``dt`` in ``tz_name`` (naive datetimes are taken as UTC)."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(ZoneInfo(tz_name)).date()


def period_for(dt: datetime, tz_name: str) -> date:
    """The month (as its first day) that ``dt`` falls in, locally."""
    return month_start(local_date(dt, tz_name))


async def household_timezone(session: AsyncSession, household_id: UUID) -> str:
    tz = await session.scalar(select(Household.timezone).where(Household.id == household_id))
    return tz or "Asia/Kolkata"
