"""Catching up: balance checks, SMS-imported transfers, password recovery, crash reports."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from app.config import get_settings
from app.factory import create_app
from app.modules.accounts.schemas import ReconcileBody
from app.modules.accounts.service import AccountService
from app.modules.categories.schemas import CategoryCreate
from app.modules.categories.service import CategoryService
from app.modules.client_errors.schemas import ClientErrorCreate
from app.modules.client_errors.service import MAX_PER_HOUR, record_client_error
from app.modules.errors import ConflictError
from app.modules.summary.service import SummaryService
from app.modules.transactions.repository import TransactionFilter
from app.modules.transactions.service import TransactionService
from app.modules.transfers.schemas import TransferCreate
from app.modules.transfers.service import TransferService
from starlette.testclient import TestClient

from tests.integration.conftest import (
    create_account,
    create_actor,
    fetch_balance,
    make_sessionmaker,
    run,
)

WHEN = datetime(2026, 10, 9, 6, 30, tzinfo=UTC)


def test_balance_check_records_the_gap_as_unaccounted_spending() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        hdfc = await create_account(sm, actor, name="HDFC", balance="10000")

        async with sm() as s:
            result = await AccountService(s).reconcile(
                actor, hdfc, ReconcileBody(balance=Decimal("6160"), occurred_at=WHEN)
            )
        assert result is not None
        assert result.difference == Decimal("-3840.0000")
        assert result.account.balance == Decimal("6160.0000")
        assert await fetch_balance(sm, hdfc) == Decimal("6160.0000")

        async with sm() as s:
            tx = await TransactionService(s).get(actor, result.transaction_id)
        assert tx is not None
        assert tx.category_slug == "unaccounted" and tx.amount == Decimal("-3840.0000")

        async with sm() as s:
            summary = await SummaryService(s).month(actor, 2026, 10)
        assert summary.expense_total == Decimal("3840.0000")
        assert [c.slug for c in summary.expense_by_category] == ["unaccounted"]

    run(scenario())


def test_balance_corrections_are_not_income_or_spending() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        sbi = await create_account(sm, actor, name="SBI", balance="5000")
        cash = await create_account(sm, actor, name="Cash", balance="900", account_type="cash")

        async with sm() as s:
            up = await AccountService(s).reconcile(
                actor, sbi, ReconcileBody(balance=Decimal("5250.50"), occurred_at=WHEN)
            )
        async with sm() as s:
            down = await AccountService(s).reconcile(
                actor,
                cash,
                ReconcileBody(balance=Decimal("700"), as_spending=False, occurred_at=WHEN),
            )
        async with sm() as s:
            same = await AccountService(s).reconcile(actor, cash, ReconcileBody(balance=Decimal("700")))
        assert up and down and same
        assert same.transaction_id is None and same.difference == 0

        async with sm() as s:
            rows = await TransactionService(s).list_transactions(actor, TransactionFilter())
        assert sorted((r.category_slug, r.amount) for r in rows) == [
            ("adjustment", Decimal("-200.0000")),
            ("adjustment", Decimal("250.5000")),
        ]
        async with sm() as s:
            summary = await SummaryService(s).month(actor, 2026, 10)
        assert summary.expense_total == 0 and summary.income_total == 0
        assert await fetch_balance(sm, sbi) == Decimal("5250.5000")

    run(scenario())


def test_balance_check_is_scoped_to_the_household() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        me = await create_actor(sm)
        stranger = await create_actor(sm)
        mine = await create_account(sm, me, balance="100")
        async with sm() as s:
            assert await AccountService(s).reconcile(stranger, mine, ReconcileBody(balance=Decimal("0"))) is None
        assert await fetch_balance(sm, mine) == Decimal("100.0000")

    run(scenario())


def test_sms_transfer_dedupes_each_leg() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        sbi = await create_account(sm, actor, name="SBI", balance="5000")
        hdfc = await create_account(sm, actor, name="HDFC", balance="0")

        def body(**refs) -> TransferCreate:
            return TransferCreate(
                source_account_id=sbi,
                dest_account_id=hdfc,
                amount=Decimal("2000"),
                occurred_at=WHEN,
                source="sms",
                **refs,
            )

        async with sm() as s:
            t = await TransferService(s).create(actor, body(source_ref="sms:debit", dest_source_ref="sms:credit"))
        async with sm() as s:
            legs = await TransactionService(s).list_transactions(actor, TransactionFilter())
        assert {(leg.source, leg.source_ref) for leg in legs} == {("sms", "sms:debit"), ("sms", "sms:credit")}
        assert all(leg.transfer_id == t.transfer_id for leg in legs)

        # Re-importing either SMS is refused, and nothing moves.
        for refs in ({"source_ref": "sms:debit"}, {"dest_source_ref": "sms:credit"}):
            async with sm() as s:
                with pytest.raises(ConflictError):
                    await TransferService(s).create(actor, body(**refs))
        async with sm() as s:
            with pytest.raises(ValueError):
                await TransferService(s).create(actor, body(source_ref="x", dest_source_ref="x"))
        assert await fetch_balance(sm, sbi) == Decimal("3000.0000")
        assert await fetch_balance(sm, hdfc) == Decimal("2000.0000")

    run(scenario())


def test_new_households_get_unaccounted_and_adjustment_is_reserved() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        async with sm() as s:
            slugs = {c.slug for c in await CategoryService(s).list_categories(actor)}
        assert "unaccounted" in slugs
        async with sm() as s:
            created = await CategoryService(s).create(
                actor, CategoryCreate(name="Adjustment", kind="expense", icon="dots")
            )
        assert created.slug == "adjustment-2"

    run(scenario())


def test_client_errors_are_stored_and_capped() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        body = ClientErrorCreate(message="TypeError: x is undefined", fatal=True, app_version="1.1.0")
        stored = []
        for _ in range(MAX_PER_HOUR + 2):
            async with sm() as s:
                stored.append(await record_client_error(s, actor, body))
        assert stored.count(True) == MAX_PER_HOUR
        assert stored[-1] is False

    run(scenario())


def _register(client: TestClient, email: str, password: str) -> str:
    resp = client.post("/v1/auth/register", json={"email": email, "password": password})
    assert resp.status_code == 201, resp.text
    assert resp.json()["user"]["has_recovery_key"] is False
    return resp.json()["csrf_token"]


def test_forgotten_password_is_reset_with_the_recovery_key() -> None:
    get_settings.cache_clear()
    email = f"recover-{uuid.uuid4()}@example.com"
    with TestClient(create_app(enable_auth=True)) as client:
        csrf = _register(client, email, "old-pass-123")
        client.headers["X-CSRF-Token"] = csrf
        key = client.post("/v1/auth/recovery-key").json()["recovery_key"]
        assert len(key) == 19 and key.count("-") == 3
        assert client.get("/v1/auth/session").json()["user"]["has_recovery_key"] is True
        client.post("/v1/auth/logout")
        client.cookies.clear()
        del client.headers["X-CSRF-Token"]

        wrong = client.post(
            "/v1/auth/reset-password",
            json={"email": email, "recovery_key": "AAAA-BBBB-CCCC-DDDD", "new_password": "new-pass-123"},
        )
        assert wrong.status_code == 401

        # Typed in lowercase without dashes still works; it signs you in.
        ok = client.post(
            "/v1/auth/reset-password",
            json={"email": email, "recovery_key": key.replace("-", "").lower(), "new_password": "new-pass-123"},
        )
        assert ok.status_code == 200, ok.text
        assert ok.json()["authenticated"] is True
        assert ok.json()["user"]["has_recovery_key"] is False  # used up

        client.cookies.clear()
        assert client.post("/v1/auth/login", json={"email": email, "password": "old-pass-123"}).status_code == 401
        assert client.post("/v1/auth/login", json={"email": email, "password": "new-pass-123"}).status_code == 200

        # The used key can't be replayed.
        client.cookies.clear()
        again = client.post(
            "/v1/auth/reset-password",
            json={"email": email, "recovery_key": key, "new_password": "other-pass-123"},
        )
        assert again.status_code == 401


def test_change_password_needs_the_current_one() -> None:
    get_settings.cache_clear()
    email = f"change-{uuid.uuid4()}@example.com"
    with TestClient(create_app(enable_auth=True)) as client:
        client.headers["X-CSRF-Token"] = _register(client, email, "first-pass-1")
        bad = client.post(
            "/v1/auth/change-password",
            json={"current_password": "nope-nope", "new_password": "second-pass-2"},
        )
        assert bad.status_code == 400
        good = client.post(
            "/v1/auth/change-password",
            json={"current_password": "first-pass-1", "new_password": "second-pass-2"},
        )
        assert good.status_code == 200
        client.cookies.clear()
        assert client.post("/v1/auth/login", json={"email": email, "password": "second-pass-2"}).status_code == 200


def test_crash_report_and_reconcile_over_http() -> None:
    get_settings.cache_clear()
    with TestClient(create_app(enable_auth=True)) as client:
        client.headers["X-CSRF-Token"] = _register(client, f"http-{uuid.uuid4()}@example.com", "pw-123456")
        acc = client.post("/v1/accounts", json={"display_name": "Cash", "account_type": "cash", "balance": "500"})
        resp = client.post(f"/v1/accounts/{acc.json()['id']}/reconcile", json={"balance": "320"})
        assert resp.status_code == 200, resp.text
        assert Decimal(resp.json()["difference"]) == Decimal("-180")
        assert resp.json()["transaction_id"]

        report = client.post(
            "/v1/client-errors",
            json={"message": "boom", "stack": "at Home", "context": {"screen": "Home"}},
        )
        assert report.status_code == 202 and report.json() == {"stored": True}
