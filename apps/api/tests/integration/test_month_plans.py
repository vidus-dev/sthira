"""Month-specific plans, walked through like the owner's notebook for one month."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from app.config import get_settings
from app.factory import create_app
from app.modules.errors import NotFoundError
from app.modules.month_plans.schemas import CarryBody, LineCreate, LinePay, LineUpdate, PlanUpdate
from app.modules.month_plans.service import MonthPlanService
from app.modules.monthly_payments.schemas import MonthlyPaymentCreate
from app.modules.monthly_payments.service import MonthlyPaymentService
from app.modules.periods import add_months, period_for
from app.modules.transactions.schemas import TransactionCreate
from app.modules.transactions.service import TransactionService
from app.modules.transfers.schemas import TransferCreate
from app.modules.transfers.service import TransferService
from starlette.testclient import TestClient

from tests.integration.conftest import create_account, create_actor, make_sessionmaker, run

THIS = period_for(datetime.now(UTC), "Asia/Kolkata")
NEXT = add_months(THIS, 1)


def at(day: date, hour: int = 6) -> datetime:
    """A time on ``day`` (UTC 06:00 = 11:30 in India, safely inside that local day)."""
    return datetime(day.year, day.month, day.day, hour, tzinfo=UTC)


async def _setup(sm):
    actor = await create_actor(sm)
    acc = {
        "sbi": await create_account(sm, actor, name="SBI", balance="200000"),
        "icici": await create_account(sm, actor, name="ICICI", balance="0"),
        "a1234": await create_account(sm, actor, name="Donations 1234", balance="0"),
        "card": await create_account(sm, actor, name="ICICI Card", balance="0", account_type="credit"),
    }
    rules = [
        dict(name="Rent", category_slug="rent", amount_type="fixed", amount=Decimal("37000")),
        dict(name="10%", category_slug="guru-dakshina", amount_type="percent", percent=Decimal("10")),
        dict(
            name="5%",
            category_slug="donations",
            amount_type="percent",
            percent=Decimal("5"),
            kind="allowance",
            dest_account_id=acc["a1234"],
        ),
        dict(
            name="Groceries",
            category_slug="groceries",
            amount_type="fixed",
            amount=Decimal("5000"),
            kind="allowance",
            dest_account_id=acc["icici"],
            default_account_id=acc["sbi"],
        ),
        dict(name="Current", category_slug="electricity", amount_type="variable"),
        dict(
            name="Misc",
            category_slug="other",
            amount_type="fixed",
            amount=Decimal("3000"),
            kind="allowance",
            covers_rest=True,
        ),
    ]
    async with sm() as s:
        svc = MonthlyPaymentService(s)
        for r in rules:
            await svc.create(actor, MonthlyPaymentCreate(**r))
    return actor, acc


async def _tx(sm, actor, account, amount: str, slug: str, when: datetime, **extra):
    async with sm() as s:
        return await TransactionService(s).create(
            actor,
            TransactionCreate(account_id=account, amount=Decimal(amount), category_slug=slug, occurred_at=when, **extra),
        )


def _line(plan, name: str):
    return next(p for p in plan.items if p.name == name)


async def _plan(sm, actor, month: date = THIS):
    async with sm() as s:
        return await MonthPlanService(s).get(actor, month.year, month.month)


def test_a_month_like_the_notebook() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor, acc = await _setup(sm)
        # Salary on the last day of last month; rent paid on the 1st, before any plan.
        await _tx(sm, actor, acc["sbi"], "140000", "salary", at(THIS - timedelta(days=1), 8))
        await _tx(sm, actor, acc["sbi"], "-37000", "rent", at(THIS))

        plan = await _plan(sm, actor)
        assert plan.exists and not plan.reviewed
        assert plan.salary.effective == Decimal("140000.0000")
        assert [e.date for e in plan.salary.entries] == [THIS - timedelta(days=1)]
        assert [p.name for p in plan.items] == ["Rent", "10%", "5%", "Groceries", "Current", "Misc"]
        assert all(p.repeats for p in plan.items)

        rent = _line(plan, "Rent")
        assert rent.status == "paid" and len(rent.payments) == 1  # linked when the plan was made
        assert _line(plan, "10%").due_amount == Decimal("14000.00")
        assert _line(plan, "5%").due_amount == Decimal("7000.00")
        assert _line(plan, "Current").status == "needs_amount"
        assert _line(plan, "Misc").status == "tracking"
        assert plan.needs_amount_count == 1

        # Groceries: one tap moves ₹5,000 to ICICI; spending is counted against it.
        async with sm() as s:
            plan = await MonthPlanService(s).pay_line(
                actor, THIS.year, THIS.month, _line(plan, "Groceries").id, LinePay(occurred_at=at(THIS + timedelta(days=1)))
            )
        groceries = _line(plan, "Groceries")
        assert groceries.status == "paid" and groceries.paid_amount == Decimal("5000.0000")
        await _tx(sm, actor, acc["icici"], "-1240", "groceries", at(THIS + timedelta(days=2)))
        # Everything else (snacks, auto) is Misc.
        await _tx(sm, actor, acc["sbi"], "-90", "dining-out", at(THIS + timedelta(days=2)))
        await _tx(sm, actor, acc["sbi"], "-80", "transport", at(THIS + timedelta(days=2)))

        # 5%: moved to account 1234 by hand (not via Pay) still counts; then the card bill
        # is paid from that account, leaving the bucket short.
        async with sm() as s:
            await TransferService(s).create(
                actor,
                TransferCreate(source_account_id=acc["sbi"], dest_account_id=acc["a1234"], amount=Decimal("7000"), occurred_at=at(THIS)),
            )
        async with sm() as s:
            await TransferService(s).create(
                actor,
                TransferCreate(source_account_id=acc["a1234"], dest_account_id=acc["card"], amount=Decimal("5600"), occurred_at=at(THIS + timedelta(days=1))),
            )

        plan = await _plan(sm, actor)
        groceries = _line(plan, "Groceries")
        assert (groceries.spent_amount, groceries.left_amount) == (Decimal("1240.0000"), Decimal("3760.0000"))
        misc = _line(plan, "Misc")
        assert misc.spent_amount == Decimal("170.0000") and misc.left_amount == Decimal("2830.0000")
        donations = _line(plan, "5%")
        assert donations.status == "paid" and donations.paid_amount == Decimal("7000.00")
        buckets = {b.account_id: b for b in plan.buckets}
        assert buckets[acc["icici"]].short == 0
        assert buckets[acc["a1234"]].reserved == Decimal("7000.00")
        assert buckets[acc["a1234"]].short == Decimal("5600.0000")

        # Current: fill in this month's amount, then the bill entry ticks it off by itself.
        async with sm() as s:
            plan = await MonthPlanService(s).update_line(
                actor, THIS.year, THIS.month, _line(plan, "Current").id, LineUpdate(amount=Decimal("2657"))
            )
        assert _line(plan, "Current").status == "due"
        paid = await _tx(sm, actor, acc["sbi"], "-2657", "electricity", at(THIS + timedelta(days=3)))
        assert paid.plan_item_id == _line(plan, "Current").id
        assert paid.monthly_payment_id == _line(plan, "Current").template_id
        # A second rent-category expense doesn't attach to the already-paid rent.
        extra = await _tx(sm, actor, acc["sbi"], "-500", "rent", at(THIS + timedelta(days=3)))
        assert extra.plan_item_id is None

        plan = await _plan(sm, actor)
        assert _line(plan, "Current").status == "paid"
        assert plan.settled_count == 4 and plan.total_count == 5  # 10% still due; Misc is watched

    run(scenario())


def test_only_this_month_or_from_now_on_and_rollover() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor, acc = await _setup(sm)
        await _tx(sm, actor, acc["sbi"], "140000", "salary", at(THIS + timedelta(days=1)))
        plan = await _plan(sm, actor)
        rent = _line(plan, "Rent")

        async with sm() as s:
            plan = await MonthPlanService(s).update_line(actor, THIS.year, THIS.month, rent.id, LineUpdate(amount=Decimal("38000")))
        async with sm() as s:
            plan = await MonthPlanService(s).update_line(actor, THIS.year, THIS.month, _line(plan, "Current").id, LineUpdate(amount=Decimal("2657")))
        async with sm() as s:
            plan = await MonthPlanService(s).add_line(
                actor, THIS.year, THIS.month,
                LineCreate(name="Gas repair", category_slug="household", amount=Decimal("3200"), repeat=False),
            )
        assert _line(plan, "Gas repair").repeats is False
        async with sm() as s:
            plan = await MonthPlanService(s).add_line(
                actor, THIS.year, THIS.month,
                LineCreate(name="Maid", category_slug="household", amount=Decimal("3000")),
            )

        nxt = await _plan(sm, actor, NEXT)
        names = [p.name for p in nxt.items]
        assert "Gas repair" not in names and "Maid" in names
        assert _line(nxt, "Rent").amount == Decimal("37000.0000")  # changed for this month only
        current = _line(nxt, "Current")
        assert current.amount is None and current.status == "needs_amount"
        assert current.last_month_amount == Decimal("2657.0000")
        # Salary on the 2nd of this month doesn't count for next month.
        assert _line(nxt, "10%").status == "awaiting_income"

        # Rent goes up from now on: next month's (already open, unpaid) line follows.
        async with sm() as s:
            await MonthPlanService(s).update_line(
                actor, THIS.year, THIS.month, rent.id, LineUpdate(amount=Decimal("40000"), scope="future")
            )
        nxt = await _plan(sm, actor, NEXT)
        assert _line(nxt, "Rent").amount == Decimal("40000.0000")

        # Stop Maid from next month on.
        async with sm() as s:
            await MonthPlanService(s).update_line(actor, THIS.year, THIS.month, _line(plan, "Maid").id, LineUpdate(repeat=False))
        nxt = await _plan(sm, actor, NEXT)
        assert "Maid" not in [p.name for p in nxt.items]

        # Last month's unpaid bills are offered in the new month.
        unpaid = {u.name: u for u in nxt.previous_unpaid}
        assert unpaid["10%"].remaining == Decimal("14000.00")
        assert "Groceries" not in unpaid  # allowances aren't carried
        async with sm() as s:
            nxt = await MonthPlanService(s).carry(actor, NEXT.year, NEXT.month, CarryBody(item_id=unpaid["10%"].item_id, action="move"))
        carried = next(p for p in nxt.items if p.carried_from_id == unpaid["10%"].item_id)
        assert carried.amount == Decimal("14000.0000") and carried.repeats is False
        assert carried.name.startswith("10% (")
        async with sm() as s:
            nxt = await MonthPlanService(s).carry(actor, NEXT.year, NEXT.month, CarryBody(item_id=unpaid["Rent"].item_id, action="done"))
        # The rest of this month's unpaid bills still wait for a decision.
        assert {u.name for u in nxt.previous_unpaid} == {"Gas repair", "Current", "Maid"}

    run(scenario())


def test_salary_override_review_and_limits() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor, acc = await _setup(sm)
        # Salary on the last day of this month counts for next month.
        last_day = NEXT - timedelta(days=1)
        await _tx(sm, actor, acc["sbi"], "150000", "salary", at(last_day, 8))
        nxt = await _plan(sm, actor, NEXT)
        assert nxt.salary.auto == Decimal("150000.0000")
        assert _line(nxt, "10%").due_amount == Decimal("15000.00")

        async with sm() as s:
            nxt = await MonthPlanService(s).update_plan(actor, NEXT.year, NEXT.month, PlanUpdate(salary_override=Decimal("100000"), reviewed=True))
        assert nxt.reviewed and _line(nxt, "5%").due_amount == Decimal("5000.00")
        async with sm() as s:
            nxt = await MonthPlanService(s).update_plan(actor, NEXT.year, NEXT.month, PlanUpdate(salary_override=None))
        assert nxt.salary.effective == Decimal("150000.0000")

        far = add_months(THIS, 3)
        async with sm() as s:
            with pytest.raises(ValueError):
                await MonthPlanService(s).get(actor, far.year, far.month)
        # Before the household existed: shown empty, nothing stored.
        old = add_months(THIS, -6)
        empty = await _plan(sm, actor, old)
        assert not empty.exists and empty.items == []

        # Someone else's line is out of reach.
        stranger = await create_actor(sm)
        plan = await _plan(sm, actor)
        await _plan(sm, stranger)
        async with sm() as s:
            with pytest.raises(NotFoundError):
                await MonthPlanService(s).close_line(stranger, THIS.year, THIS.month, plan.items[0].id, True)
        async with sm() as s:
            with pytest.raises(ValueError):
                await TransactionService(s).create(
                    stranger,
                    TransactionCreate(
                        account_id=await create_account(sm, stranger),
                        amount=Decimal("-1"),
                        occurred_at=at(THIS),
                        plan_item_id=plan.items[0].id,
                    ),
                )

    run(scenario())


def test_plans_over_http_and_undo_auto_link() -> None:
    get_settings.cache_clear()
    with TestClient(create_app(enable_auth=True)) as client:
        resp = client.post("/v1/auth/register", json={"email": f"plan-{uuid.uuid4()}@example.com", "password": "pw-123456"})
        client.headers["X-CSRF-Token"] = resp.json()["csrf_token"]
        acc = client.post("/v1/accounts", json={"display_name": "SBI", "balance": "50000"}).json()["id"]
        client.post("/v1/monthly-payments", json={"name": "Maid", "category_slug": "household", "amount": "3000"})

        plan = client.get(f"/v1/plans/{THIS.year}/{THIS.month}")
        assert plan.status_code == 200, plan.text
        maid = plan.json()["items"][0]
        assert maid["status"] == "due"

        tx = client.post(
            "/v1/transactions",
            json={"account_id": acc, "amount": "-3000", "category_slug": "household", "occurred_at": at(THIS + timedelta(days=1)).isoformat()},
        ).json()
        assert tx["plan_item_id"] == maid["id"]
        # Undo the automatic link.
        undone = client.patch(f"/v1/transactions/{tx['id']}", json={"plan_item_id": None}).json()
        assert undone["plan_item_id"] is None and undone["monthly_payment_id"] is None
        again = client.get(f"/v1/plans/{THIS.year}/{THIS.month}").json()
        assert again["items"][0]["status"] == "due"

        closed = client.post(f"/v1/plans/{THIS.year}/{THIS.month}/items/{maid['id']}/close", json={"closed": True})
        assert closed.json()["items"][0]["status"] == "paid"
        gone = client.delete(f"/v1/plans/{THIS.year}/{THIS.month}/items/{maid['id']}?also_future=true")
        assert gone.json()["items"] == []
        nxt = client.get(f"/v1/plans/{NEXT.year}/{NEXT.month}").json()
        assert nxt["items"] == []


def test_payee_upi_follows_the_item_into_later_months() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        async with sm() as s:
            await MonthPlanService(s).get(actor, THIS.year, THIS.month)
        async with sm() as s:
            plan = await MonthPlanService(s).add_line(
                actor, THIS.year, THIS.month,
                LineCreate(name="Donations", category_slug="donations", amount=Decimal("5500"),
                           payee_upi="  Amma.K@OKICICI ", payee_name=" Amma "),
            )
        line = next(i for i in plan.items if i.name == "Donations")
        assert (line.payee_upi, line.payee_name) == ("amma.k@okicici", "Amma")

        async with sm() as s:
            nxt = await MonthPlanService(s).get(actor, NEXT.year, NEXT.month)
        copied = next(i for i in nxt.items if i.name == "Donations")
        assert copied.payee_upi == "amma.k@okicici"

        # Changed "from now on" reaches next month too; empty clears it.
        async with sm() as s:
            await MonthPlanService(s).update_line(
                actor, THIS.year, THIS.month, line.id, LineUpdate(payee_upi="", scope="future"),
            )
        async with sm() as s:
            nxt = await MonthPlanService(s).get(actor, NEXT.year, NEXT.month)
        assert next(i for i in nxt.items if i.name == "Donations").payee_upi is None

        with pytest.raises(ValueError):
            LineUpdate(payee_upi="9876543210")  # a phone number alone isn't a UPI ID

    run(scenario())
