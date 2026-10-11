"""CSV export of every entry in a household — a backup that opens in Excel / Sheets."""

import csv
import io
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor
from app.models.account import FinancialAccount
from app.models.category import Category
from app.models.monthly_payment import MonthlyPayment
from app.models.transaction import LedgerTransaction
from app.models.user import User
from app.modules.periods import household_timezone

HEADER = [
    "Date",
    "Time",
    "Type",
    "Amount",
    "Account",
    "Category",
    "Note",
    "Added by",
    "Monthly plan item",
    "Plan month",
    "Source",
]

_SPECIAL_SLUGS = {
    "transfer": "Transfer",
    "uncategorized": "Uncategorized",
    "adjustment": "Balance correction",
}


def _kind(tx: LedgerTransaction) -> str:
    if tx.transfer_id is not None:
        return "Transfer out" if tx.amount < 0 else "Transfer in"
    if tx.category_slug == "adjustment":
        return "Correction"
    return "Expense" if tx.amount < 0 else "Income"


async def transactions_csv(session: AsyncSession, actor: Actor) -> str:
    """All active entries, oldest first, dates in the household's timezone.

    Amounts are signed (money out is negative) so a column sum is the net change.
    Each leg of a transfer is its own row, so nothing is lost.
    """
    hid = actor.household_id
    tz = ZoneInfo(await household_timezone(session, hid))

    async def names(model, key, label, *where) -> dict:
        rows = await session.execute(select(getattr(model, key), label).where(*where))
        return dict(rows.all())

    accounts = await names(FinancialAccount, "id", FinancialAccount.display_name, FinancialAccount.household_id == hid)
    categories = await names(Category, "slug", Category.name, Category.household_id == hid)
    items = await names(MonthlyPayment, "id", MonthlyPayment.name, MonthlyPayment.household_id == hid)
    people = await session.execute(select(User.id, User.display_name, User.email).where(User.household_id == hid))
    members = {uid: name or email.split("@")[0] for uid, name, email in people.all()}

    rows = await session.execute(
        select(LedgerTransaction)
        .where(LedgerTransaction.household_id == hid, LedgerTransaction.deleted_at.is_(None))
        .order_by(LedgerTransaction.occurred_at, LedgerTransaction.created_at)
    )

    out = io.StringIO()
    out.write("﻿")  # BOM so Excel reads UTF-8 names correctly
    writer = csv.writer(out)
    writer.writerow(HEADER)
    for tx in rows.scalars():
        local = tx.occurred_at.astimezone(tz)
        writer.writerow(
            [
                local.strftime("%Y-%m-%d"),
                local.strftime("%H:%M"),
                _kind(tx),
                f"{tx.amount:.2f}",
                accounts.get(tx.account_id, ""),
                _SPECIAL_SLUGS.get(tx.category_slug) or categories.get(tx.category_slug, tx.category_slug),
                tx.description,
                members.get(tx.user_id, ""),
                items.get(tx.monthly_payment_id, "") if tx.monthly_payment_id else "",
                tx.period_month.strftime("%Y-%m") if tx.period_month else "",
                tx.source,
            ]
        )
    return out.getvalue()
