"""DB-backed tests for the total-balance history and month-by-month savings."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from app.config import get_settings
from app.factory import create_app
from app.models.account import FinancialAccount
from app.modules.periods import add_months
from app.modules.summary.service import SummaryService
from app.modules.transactions.schemas import TransactionCreate
from app.modules.transactions.service import TransactionService
from app.modules.transfers.schemas import TransferCreate
from app.modules.transfers.service import TransferService
from starlette.testclient import TestClient

from tests.integration.conftest import create_account, create_actor, make_sessionmaker, run

IST = ZoneInfo("Asia/Kolkata")
TODAY = datetime.now(IST).date()


def _noon(d: date) -> datetime:
    return datetime.combine(d, time(12), tzinfo=IST)


def _tx(account_id, amount: str, slug: str, when: datetime) -> TransactionCreate:
    return TransactionCreate(
        account_id=account_id, amount=Decimal(amount), category_slug=slug, occurred_at=when
    )


async def _opened(sm, account_id, days_ago: int) -> None:
    async with sm() as s:
        acc = await s.get(FinancialAccount, account_id)
        acc.created_at = _noon(TODAY - timedelta(days=days_ago))
        await s.commit()


def test_balance_history_rebuilds_each_day_from_todays_balances() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        me = await create_actor(sm)
        bank = await create_account(sm, me, name="SBI", balance="10000")
        card = await create_account(sm, me, name="HDFC card", balance="0", account_type="credit")
        await _opened(sm, bank, 10)
        await _opened(sm, card, 3)

        async with sm() as s:
            svc = TransactionService(s)
            await svc.create(me, _tx(bank, "-500", "groceries", _noon(TODAY - timedelta(days=5))))
            await svc.create(me, _tx(bank, "2000", "salary", _noon(TODAY - timedelta(days=2))))
            await svc.create(me, _tx(card, "-300", "shopping", datetime.now(UTC)))
            gone = await svc.create(me, _tx(bank, "-999", "other", _noon(TODAY - timedelta(days=3))))
        async with sm() as s:
            await TransactionService(s).delete(me, gone.id)
        async with sm() as s:
            await TransferService(s).create(
                me,
                TransferCreate(
                    source_account_id=bank,
                    dest_account_id=card,
                    amount=Decimal("1000"),
                    occurred_at=_noon(TODAY - timedelta(days=1)),
                ),
            )

        async with sm() as s:
            history = await SummaryService(s).balance_history(me, 30)

        by_age = {(TODAY - p.day).days: p.total for p in history.points}
        # Starts the day the first account was added; bank 10,500 + card 700 today.
        assert min(by_age) == 0 and max(by_age) == 10
        assert by_age[0] == Decimal("11200")
        assert by_age[1] == Decimal("11500")  # before today's card spend
        assert by_age[2] == Decimal("11500")  # the transfer between own accounts nets out
        assert by_age[3] == Decimal("9500")  # before the salary; the deleted entry never counts
        assert by_age[4] == Decimal("9500")  # card not added yet (it held 0 then anyway)
        assert by_age[5] == Decimal("9500")
        assert by_age[6] == Decimal("10000")  # before the groceries
        assert by_age[10] == Decimal("10000")
        assert [p.day for p in history.points] == sorted(p.day for p in history.points)

        async with sm() as s:
            short = await SummaryService(s).balance_history(me, 4)
        assert len(short.points) == 4 and short.points[-1].total == Decimal("11200")

        empty = await create_actor(sm)
        async with sm() as s:
            assert (await SummaryService(s).balance_history(empty, 30)).points == []

    run(scenario())


def test_savings_counts_salary_in_the_plan_window() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        me = await create_actor(sm)
        bank = await create_account(sm, me, name="SBI", balance="0")
        cash = await create_account(sm, me, name="Cash", balance="0", account_type="cash")
        this = TODAY.replace(day=1)
        prev = add_months(this, -1)
        before = add_months(this, -2)
        last_day = lambda m: add_months(m, 1) - timedelta(days=1)  # noqa: E731

        async with sm() as s:
            svc = TransactionService(s)
            # Salary on the last day of a month is next month's salary.
            await svc.create(me, _tx(bank, "100000", "salary", _noon(last_day(before))))
            await svc.create(me, _tx(bank, "-30000", "rent", _noon(prev.replace(day=10))))
            await svc.create(me, _tx(bank, "100000", "salary", _noon(last_day(prev))))
            first_of_month = datetime.combine(this, time(0, 30), tzinfo=IST)
            await svc.create(me, _tx(bank, "500", "interest-refunds", first_of_month))
            await svc.create(me, _tx(bank, "-20000", "rent", first_of_month))
        async with sm() as s:
            await TransferService(s).create(
                me,
                TransferCreate(
                    source_account_id=bank, dest_account_id=cash, amount=Decimal("2000"),
                    occurred_at=first_of_month,
                ),
            )

        async with sm() as s:
            result = await SummaryService(s).savings(me, 4)

        months = [(m.year, m.month) for m in result.months]
        # Three months back had nothing; two back only had next month's salary.
        assert months == [(prev.year, prev.month), (this.year, this.month)]
        p, c = result.months
        assert (p.salary, p.income, p.expense, p.net) == (
            Decimal("100000"), Decimal("100000"), Decimal("30000"), Decimal("70000"),
        )
        assert (c.salary, c.income, c.expense, c.net) == (
            Decimal("100000"), Decimal("100500"), Decimal("20000"), Decimal("80500"),
        )

        empty = await create_actor(sm)
        async with sm() as s:
            only_now = (await SummaryService(s).savings(empty, 6)).months
        assert [(m.year, m.month, m.net) for m in only_now] == [(this.year, this.month, 0)]

    run(scenario())


@pytest.mark.parametrize("path", ["/v1/summary/balance-history?days=30", "/v1/summary/savings?months=6"])
def test_history_endpoints_over_http(path: str) -> None:
    get_settings.cache_clear()
    with TestClient(create_app(enable_auth=True)) as client:
        resp = client.post(
            "/v1/auth/register",
            json={"email": f"hist-{uuid.uuid4()}@example.com", "password": "pw-123456"},
        )
        client.headers["X-CSRF-Token"] = resp.json()["csrf_token"]
        client.post("/v1/accounts", json={"display_name": "SBI", "balance": "50000"})
        resp = client.get(path)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        if "points" in body:
            assert body["points"][-1]["total"] in ("50000", "50000.0000")
        else:
            assert body["months"][-1]["net"] in ("0", "0.0000")
        assert client.get(path.split("?")[0] + "?days=1&months=0").status_code == 422
