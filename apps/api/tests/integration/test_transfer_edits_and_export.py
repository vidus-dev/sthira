"""Editing / deleting a transfer moves both legs; CSV export of a household's entries."""

from __future__ import annotations

import csv
import io
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from app.models.transaction import LedgerTransaction
from app.modules.export.service import HEADER, transactions_csv
from app.modules.monthly_payments.schemas import MonthlyPaymentCreate, PayRequest
from app.modules.monthly_payments.service import MonthlyPaymentService
from app.modules.transactions.schemas import TransactionCreate, TransactionUpdate
from app.modules.transactions.service import TransactionService
from app.modules.transfers.schemas import TransferCreate
from app.modules.transfers.service import TransferService
from sqlalchemy import select

from tests.integration.conftest import (
    create_account,
    create_actor,
    fetch_balance,
    make_sessionmaker,
    run,
)

WHEN = datetime(2026, 10, 5, 6, 30, tzinfo=UTC)  # 12:00 in India


async def _transfer(sm, actor, src, dst, amount="1000"):
    async with sm() as s:
        t = await TransferService(s).create(
            actor,
            TransferCreate(source_account_id=src, dest_account_id=dst, amount=Decimal(amount), occurred_at=WHEN),
        )
    return t


def test_editing_either_leg_updates_both_accounts() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        sbi = await create_account(sm, actor, name="SBI", balance="5000")
        hdfc = await create_account(sm, actor, name="HDFC", balance="0")
        t = await _transfer(sm, actor, sbi, hdfc)

        # Edit through the incoming leg: amount is given as positive, directions are kept.
        later = datetime(2026, 10, 6, 6, 30, tzinfo=UTC)
        async with sm() as s:
            updated = await TransactionService(s).update(
                actor,
                t.credit_transaction_id,
                TransactionUpdate(amount=Decimal("1500"), occurred_at=later, description="Bills bucket"),
            )
        assert updated is not None and updated.amount == Decimal("1500.0000")
        assert await fetch_balance(sm, sbi) == Decimal("3500.0000")
        assert await fetch_balance(sm, hdfc) == Decimal("1500.0000")

        async with sm() as s:
            legs = (
                await s.execute(select(LedgerTransaction).where(LedgerTransaction.transfer_id == t.transfer_id))
            ).scalars().all()
        assert sorted(leg.amount for leg in legs) == [Decimal("-1500.0000"), Decimal("1500.0000")]
        assert {leg.description for leg in legs} == {"Bills bucket"}
        assert {leg.occurred_at for leg in legs} == {later}

    run(scenario())


def test_transfer_category_cannot_change_and_amount_must_be_positive() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        a = await create_account(sm, actor, name="A", balance="100")
        b = await create_account(sm, actor, name="B", balance="0")
        t = await _transfer(sm, actor, a, b, "50")
        with pytest.raises(ValueError, match="category"):
            async with sm() as s:
                await TransactionService(s).update(actor, t.debit_transaction_id, TransactionUpdate(category_slug="rent"))
        with pytest.raises(ValueError, match="positive"):
            async with sm() as s:
                await TransactionService(s).update(actor, t.debit_transaction_id, TransactionUpdate(amount=Decimal("0")))
        assert await fetch_balance(sm, a) == Decimal("50.0000")

    run(scenario())


def test_deleting_one_leg_removes_the_whole_transfer() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        a = await create_account(sm, actor, name="A", balance="1000")
        b = await create_account(sm, actor, name="B", balance="0")
        t = await _transfer(sm, actor, a, b, "400")
        async with sm() as s:
            assert await TransactionService(s).delete(actor, t.debit_transaction_id) is True
        assert await fetch_balance(sm, a) == Decimal("1000.0000")
        assert await fetch_balance(sm, b) == Decimal("0.0000")
        async with sm() as s:
            assert await TransactionService(s).get(actor, t.credit_transaction_id) is None

    run(scenario())


def test_csv_export_lists_every_entry_in_local_time() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        other = await create_actor(sm)  # another household: must not appear
        sbi = await create_account(sm, actor, name="SBI Salary", balance="0")
        cash = await create_account(sm, actor, name="Cash", balance="0", account_type="cash")
        theirs = await create_account(sm, other, name="Not mine")
        async with sm() as s:
            svc = TransactionService(s)
            await svc.create(actor, TransactionCreate(account_id=sbi, amount=Decimal("85000"), category_slug="salary", description="Salary", occurred_at=WHEN))
            await svc.create(actor, TransactionCreate(account_id=cash, amount=Decimal("-220.5"), category_slug="vegetables", description="Market, Sunday", occurred_at=datetime(2026, 10, 5, 19, 0, tzinfo=UTC)))
            await svc.create(other, TransactionCreate(account_id=theirs, amount=Decimal("-1"), occurred_at=WHEN))
        await _transfer(sm, actor, sbi, cash, "3000")
        async with sm() as s:
            item = await MonthlyPaymentService(s).create(actor, MonthlyPaymentCreate(name="Rent", category_slug="rent", amount_type="fixed", amount=Decimal("18000")))
        async with sm() as s:
            await MonthlyPaymentService(s).pay(actor, item.id, PayRequest(year=2026, month=9, account_id=sbi, occurred_at=WHEN))

        async with sm() as s:
            text = await transactions_csv(s, actor)
        assert text.startswith("﻿")
        rows = list(csv.reader(io.StringIO(text.lstrip("﻿"))))
        assert rows[0] == HEADER
        body = [dict(zip(HEADER, r)) for r in rows[1:]]
        assert len(body) == 5  # salary, rent, 2 transfer legs, vegetables
        assert [r["Type"] for r in body].count("Transfer out") == 1
        veg = next(r for r in body if r["Category"] == "Vegetables")
        # 19:00 UTC on 5 Oct is 00:30 on 6 Oct in India; a comma in the note stays quoted.
        assert (veg["Date"], veg["Time"], veg["Amount"], veg["Note"], veg["Account"]) == (
            "2026-10-06", "00:30", "-220.50", "Market, Sunday", "Cash"
        )
        rent = next(r for r in body if r["Category"] == "Rent")
        assert (rent["Monthly plan item"], rent["Plan month"], rent["Type"]) == ("Rent", "2026-09", "Expense")
        assert sum(Decimal(r["Amount"]) for r in body) == Decimal("85000") - Decimal("220.5") - Decimal("18000")
        assert "Not mine" not in text

    run(scenario())
