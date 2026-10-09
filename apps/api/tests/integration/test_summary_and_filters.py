"""DB-backed tests for the month summary, transaction filters and import de-duplication."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from app.modules.errors import ConflictError
from app.modules.summary.service import SummaryService
from app.modules.transactions.repository import TransactionFilter
from app.modules.transactions.schemas import TransactionCreate
from app.modules.transactions.service import TransactionService
from app.modules.transfers.schemas import TransferCreate
from app.modules.transfers.service import TransferService

from tests.integration.conftest import create_account, create_actor, make_sessionmaker, run


def _tx(account_id, amount: str, slug: str, when: datetime, **extra) -> TransactionCreate:
    return TransactionCreate(
        account_id=account_id, amount=Decimal(amount), category_slug=slug, occurred_at=when, **extra
    )


def test_month_summary_totals_categories_members_and_pace() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        me = await create_actor(sm)
        wife = await create_actor(sm, household_id=me.household_id)
        bank = await create_account(sm, me, name="SBI", balance="0")
        cash = await create_account(sm, me, name="Cash", balance="0", account_type="cash")

        async with sm() as s:
            svc = TransactionService(s)
            await svc.create(me, _tx(bank, "85000", "salary", datetime(2026, 9, 1, 5, tzinfo=UTC)))
            await svc.create(me, _tx(bank, "-18000", "rent", datetime(2026, 9, 1, 6, tzinfo=UTC)))
            await svc.create(me, _tx(bank, "-1000", "groceries", datetime(2026, 9, 20, 6, tzinfo=UTC)))
        async with sm() as s:
            svc = TransactionService(s)
            await svc.create(me, _tx(bank, "-18000", "rent", datetime(2026, 10, 1, 6, tzinfo=UTC)))
            await svc.create(wife, _tx(cash, "-220", "vegetables", datetime(2026, 10, 3, 6, tzinfo=UTC)))
            # 20:00 UTC on 9 Oct is 01:30 on 10 Oct in India.
            await svc.create(me, _tx(bank, "-450", "food-delivery", datetime(2026, 10, 9, 20, tzinfo=UTC)))
        async with sm() as s:
            await TransferService(s).create(
                me, TransferCreate(source_account_id=bank, dest_account_id=cash,
                                   amount=Decimal("2000"),
                                   occurred_at=datetime(2026, 10, 2, 6, tzinfo=UTC)),
            )

        async with sm() as s:
            october = await SummaryService(s).month(me, 2026, 10)

        assert october.expense_total == Decimal("18670.0000")  # transfer excluded
        assert october.income_total == Decimal("0")
        assert [(c.slug, c.total) for c in october.expense_by_category] == [
            ("rent", Decimal("18000.0000")),
            ("food-delivery", Decimal("450.0000")),
            ("vegetables", Decimal("220.0000")),
        ]
        assert {d.day.day: d.expense for d in october.by_day} == {
            1: Decimal("18000.0000"), 3: Decimal("220.0000"), 10: Decimal("450.0000"),
        }
        assert {m.user_id: m.expense for m in october.by_member} == {
            me.user_id: Decimal("18450.0000"), wife.user_id: Decimal("220.0000"),
        }
        assert october.days_in_month == 31
        assert (october.previous.year, october.previous.month) == (2026, 9)
        assert october.previous.expense_total == Decimal("19000.0000")
        if october.as_of_day < 20:
            assert october.previous.expense_to_same_day == Decimal("18000.0000")

        async with sm() as s:
            september = await SummaryService(s).month(me, 2026, 9)
        assert september.income_by_category[0].slug == "salary"
        assert september.net == Decimal("66000.0000")

    run(scenario())


def test_transaction_filters() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        bank = await create_account(sm, actor, name="SBI")
        async with sm() as s:
            svc = TransactionService(s)
            for day, slug in [(1, "rent"), (5, "groceries"), (12, "groceries"), (30, "fuel")]:
                await svc.create(actor, _tx(bank, "-10", slug, datetime(2026, 10, day, 6, tzinfo=UTC)))
        f = TransactionFilter(
            start=datetime(2026, 10, 2, tzinfo=UTC),
            end=datetime(2026, 10, 30, tzinfo=UTC),
            category_slug="groceries",
        )
        async with sm() as s:
            rows = await TransactionService(s).list_transactions(actor, f)
            latest = await TransactionService(s).list_transactions(actor, TransactionFilter(limit=1))
        assert [r.occurred_at.day for r in rows] == [12, 5]  # newest first
        assert latest[0].category_slug == "fuel"

    run(scenario())


def test_same_import_ref_is_accepted_once() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        partner = await create_actor(sm, household_id=actor.household_id)
        bank = await create_account(sm, actor, name="HDFC")
        when = datetime(2026, 10, 9, 15, tzinfo=UTC)
        async with sm() as s:
            created = await TransactionService(s).create(
                actor, _tx(bank, "-450", "food-delivery", when, source="sms", source_ref="sms:abc")
            )
        assert (created.source, created.source_ref) == ("sms", "sms:abc")
        # Same SMS scanned on the partner's phone, or again after deletion: refused.
        with pytest.raises(ConflictError):
            async with sm() as s:
                await TransactionService(s).create(
                    partner, _tx(bank, "-450", "food-delivery", when, source="sms", source_ref="sms:abc")
                )
        async with sm() as s:
            await TransactionService(s).delete(actor, created.id)
        with pytest.raises(ConflictError):
            async with sm() as s:
                await TransactionService(s).create(
                    actor, _tx(bank, "-450", "food-delivery", when, source="sms", source_ref="sms:abc")
                )
        # A different household can import the same reference.
        other = await create_actor(sm)
        other_bank = await create_account(sm, other)
        async with sm() as s:
            await TransactionService(s).create(
                other, _tx(other_bank, "-450", "food-delivery", when, source="sms", source_ref="sms:abc")
            )

    run(scenario())
