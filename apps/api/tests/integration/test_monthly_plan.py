"""DB-backed tests for the monthly plan: percent-of-salary items, partial payments,
variable bills, paying by transfer, and payments that count towards an earlier month."""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from app.modules.monthly_payments.schemas import (
    MonthlyPaymentCreate,
    MonthlyPaymentUpdate,
    PayRequest,
)
from app.modules.monthly_payments.service import MonthlyPaymentService
from app.modules.transactions.schemas import TransactionCreate, TransactionUpdate
from app.modules.transactions.service import TransactionService
from pydantic import ValidationError

from tests.integration.conftest import (
    create_account,
    create_actor,
    fetch_balance,
    make_sessionmaker,
    run,
)

OCT_5 = datetime(2026, 10, 5, 6, 30, tzinfo=UTC)  # noon in India


async def _salary(sm, actor, account_id, amount: str, when: datetime = OCT_5) -> None:
    async with sm() as s:
        await TransactionService(s).create(
            actor,
            TransactionCreate(
                account_id=account_id,
                amount=Decimal(amount),
                category_slug="salary",
                description="Salary",
                occurred_at=when,
            ),
        )


async def _item(sm, actor, **fields):
    async with sm() as s:
        return await MonthlyPaymentService(s).create(actor, MonthlyPaymentCreate(**fields))


async def _status(sm, actor, year=2026, month=10):
    async with sm() as s:
        plan = await MonthlyPaymentService(s).status(actor, year, month)
    return plan, {i.item.name: i for i in plan.items}


def test_percent_items_follow_the_salary_recorded_that_month() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        bank = await create_account(sm, actor, name="SBI", balance="0")
        await _item(sm, actor, name="Guru dakshina", category_slug="guru-dakshina",
                    amount_type="percent", percent=Decimal("10"), due_day=15)
        await _item(sm, actor, name="Donations", category_slug="donations",
                    amount_type="percent", percent=Decimal("5"))

        _, items = await _status(sm, actor)
        assert items["Guru dakshina"].status == "awaiting_income"
        assert items["Guru dakshina"].due_amount == Decimal("0.00")

        await _salary(sm, actor, bank, "85000")
        plan, items = await _status(sm, actor)
        guru = items["Guru dakshina"]
        assert guru.item.base_category_slug == "salary"
        assert (guru.base_amount, guru.due_amount, guru.status) == (
            Decimal("85000.0000"), Decimal("8500.00"), "due"
        )
        assert guru.due_date == date(2026, 10, 15)
        assert items["Donations"].due_amount == Decimal("4250.00")
        assert plan.base_income == {"salary": Decimal("85000.0000")}

        # A salary transfer between our own accounts doesn't count as income.
        _, items_nov = await _status(sm, actor, month=11)
        assert items_nov["Guru dakshina"].status == "awaiting_income"

    run(scenario())


def test_donations_paid_in_parts_then_settled() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        bank = await create_account(sm, actor, name="SBI", balance="0")
        await _salary(sm, actor, bank, "85000")
        item = await _item(sm, actor, name="Donations", category_slug="donations",
                           amount_type="percent", percent=Decimal("5"))

        async with sm() as s:
            after_first = await MonthlyPaymentService(s).pay(
                actor, item.id, PayRequest(year=2026, month=10, account_id=bank,
                                           amount=Decimal("2000"), occurred_at=OCT_5)
            )
        assert after_first.status == "partial"
        assert (after_first.paid_amount, after_first.remaining) == (
            Decimal("2000.0000"), Decimal("2250.0000")
        )
        assert after_first.payments[0].category_slug == "donations"

        # No amount: pays exactly what's left.
        async with sm() as s:
            settled = await MonthlyPaymentService(s).pay(
                actor, item.id, PayRequest(year=2026, month=10, account_id=bank)
            )
        assert settled.status == "paid"
        assert settled.remaining == Decimal("0")
        assert len(settled.payments) == 2
        assert await fetch_balance(sm, bank) == Decimal("80750.0000")

        plan, _ = await _status(sm, actor)
        assert (plan.settled_count, plan.total_count) == (1, 1)
        assert plan.paid_total == Decimal("4250.0000")

    run(scenario())


def test_fixed_and_variable_items() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        bank = await create_account(sm, actor, name="HDFC", balance="50000")
        rent = await _item(sm, actor, name="Rent", category_slug="rent",
                           amount_type="fixed", amount=Decimal("18000"), due_day=31)
        power = await _item(sm, actor, name="Electricity", category_slug="electricity",
                            amount_type="variable")

        async with sm() as s:
            paid_rent = await MonthlyPaymentService(s).pay(
                actor, rent.id, PayRequest(year=2026, month=11, account_id=bank)
            )
        assert paid_rent.status == "paid"
        assert paid_rent.due_date == date(2026, 11, 30)  # day 31 clamps to 30 Nov

        with pytest.raises(ValueError, match="Enter the amount"):
            async with sm() as s:
                await MonthlyPaymentService(s).pay(
                    actor, power.id, PayRequest(year=2026, month=11, account_id=bank)
                )
        async with sm() as s:
            paid_power = await MonthlyPaymentService(s).pay(
                actor, power.id,
                PayRequest(year=2026, month=11, account_id=bank, amount=Decimal("1432.50")),
            )
        assert (paid_power.status, paid_power.due_amount) == ("paid", None)
        assert await fetch_balance(sm, bank) == Decimal("30567.5000")

    run(scenario())


def test_paying_by_transfer_to_a_bucket_account() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        salary_acc = await create_account(sm, actor, name="SBI Salary", balance="0")
        bucket = await create_account(sm, actor, name="Donations bucket", balance="0")
        await _salary(sm, actor, salary_acc, "85000")
        guru = await _item(sm, actor, name="Guru dakshina", category_slug="guru-dakshina",
                           amount_type="percent", percent=Decimal("10"))

        async with sm() as s:
            status = await MonthlyPaymentService(s).pay(
                actor, guru.id,
                PayRequest(year=2026, month=10, account_id=salary_acc, dest_account_id=bucket),
            )
        assert status.status == "paid"
        assert status.payments[0].transfer_id is not None
        assert await fetch_balance(sm, bucket) == Decimal("8500.0000")
        assert await fetch_balance(sm, salary_acc) == Decimal("76500.0000")

    run(scenario())


def test_payment_made_next_month_counts_for_the_chosen_month() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        bank = await create_account(sm, actor, name="HDFC", balance="50000")
        rent = await _item(sm, actor, name="Rent", category_slug="rent",
                           amount_type="fixed", amount=Decimal("18000"))
        async with sm() as s:
            await MonthlyPaymentService(s).pay(
                actor, rent.id,
                PayRequest(year=2026, month=10, account_id=bank,
                           occurred_at=datetime(2026, 11, 2, 5, 0, tzinfo=UTC)),
            )
        _, october = await _status(sm, actor, month=10)
        _, november = await _status(sm, actor, month=11)
        assert october["Rent"].status == "paid"
        assert november["Rent"].status == "due"

    run(scenario())


def test_link_unlink_existing_transaction_and_delete_unsettles() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        bank = await create_account(sm, actor, name="HDFC", balance="10000")
        net = await _item(sm, actor, name="Internet", category_slug="internet",
                          amount_type="fixed", amount=Decimal("999"))
        async with sm() as s:
            tx = await TransactionService(s).create(
                actor,
                TransactionCreate(account_id=bank, amount=Decimal("-999"),
                                  category_slug="internet", occurred_at=OCT_5),
            )
        async with sm() as s:
            linked = await TransactionService(s).update(
                actor, tx.id, TransactionUpdate(monthly_payment_id=net.id)
            )
        assert linked.period_month == date(2026, 10, 1)
        _, items = await _status(sm, actor)
        assert items["Internet"].status == "paid"

        async with sm() as s:
            await TransactionService(s).update(
                actor, tx.id, TransactionUpdate.model_validate({"monthly_payment_id": None})
            )
        _, items = await _status(sm, actor)
        assert items["Internet"].status == "due"

        async with sm() as s:
            await TransactionService(s).update(
                actor, tx.id, TransactionUpdate(monthly_payment_id=net.id)
            )
        async with sm() as s:
            await TransactionService(s).delete(actor, tx.id)
        _, items = await _status(sm, actor)
        assert items["Internet"].status == "due"

    run(scenario())


def test_archived_item_keeps_history_but_leaves_future_months() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        bank = await create_account(sm, actor, name="HDFC", balance="10000")
        emi = await _item(sm, actor, name="Loan EMI", category_slug="loan-emi",
                          amount_type="fixed", amount=Decimal("5000"))
        async with sm() as s:
            await MonthlyPaymentService(s).pay(
                actor, emi.id, PayRequest(year=2026, month=10, account_id=bank)
            )
        async with sm() as s:
            assert await MonthlyPaymentService(s).archive(actor, emi.id) is True
        _, october = await _status(sm, actor, month=10)
        _, november = await _status(sm, actor, month=11)
        assert "Loan EMI" in october
        assert "Loan EMI" not in november

    run(scenario())


def test_item_validation() -> None:
    with pytest.raises(ValidationError, match="fixed payment needs an amount"):
        MonthlyPaymentCreate(name="Rent", category_slug="rent", amount_type="fixed")
    with pytest.raises(ValidationError, match="percent"):
        MonthlyPaymentCreate(name="Guru", category_slug="guru-dakshina", amount_type="percent")

    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        item = await _item(sm, actor, name="Rent", category_slug="rent",
                           amount_type="fixed", amount=Decimal("18000"))
        with pytest.raises(ValueError, match="percent"):
            async with sm() as s:
                await MonthlyPaymentService(s).update(
                    actor, item.id, MonthlyPaymentUpdate(amount_type="percent")
                )
        with pytest.raises(ValueError, match="Account not found"):
            await _item(sm, await create_actor(sm), name="X", category_slug="rent",
                        amount_type="fixed", amount=Decimal("1"),
                        default_account_id=await create_account(sm, actor))

    run(scenario())
