"""DB-backed tests for account-to-account transfers."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from app.models.transaction import LedgerTransaction
from app.modules.transfers.schemas import TransferCreate
from app.modules.transfers.service import TransferService
from sqlalchemy import select

from tests.integration.conftest import fetch_balance, make_sessionmaker, run


async def _user_with_two_accounts(
    sm, *, source_balance: str = "0", dest_balance: str = "0", currency: str = "INR"
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    from app.models.account import FinancialAccount
    from app.models.user import User

    user = User(email=f"itest-{uuid.uuid4()}@example.com", hashed_password="x")
    source = FinancialAccount(
        user=user, display_name="Source", balance=Decimal(source_balance), currency=currency
    )
    dest = FinancialAccount(
        user=user, display_name="Dest", balance=Decimal(dest_balance), currency=currency
    )
    async with sm() as s:
        s.add(user)
        s.add(source)
        s.add(dest)
        await s.commit()
        return user.id, source.id, dest.id


def _body(source_id: uuid.UUID, dest_id: uuid.UUID, amount: str) -> TransferCreate:
    return TransferCreate(
        source_account_id=source_id,
        dest_account_id=dest_id,
        amount=Decimal(amount),
        occurred_at=datetime(2026, 6, 1, 12, 0, tzinfo=UTC),
    )


def test_transfer_moves_money_between_accounts() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id, source_id, dest_id = await _user_with_two_accounts(
            sm, source_balance="100", dest_balance="0"
        )
        async with sm() as s:
            result = await TransferService(s).create(user_id, _body(source_id, dest_id, "30"))

        assert await fetch_balance(sm, source_id) == Decimal("70.0000")
        assert await fetch_balance(sm, dest_id) == Decimal("30.0000")

        async with sm() as s:
            legs = (
                (
                    await s.execute(
                        select(LedgerTransaction).where(
                            LedgerTransaction.transfer_id == result.transfer_id
                        )
                    )
                )
                .scalars()
                .all()
            )
        assert len(legs) == 2
        assert sorted(leg.amount for leg in legs) == [Decimal("-30.0000"), Decimal("30.0000")]

    run(scenario())


def test_transfer_to_same_account_is_rejected() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id, source_id, _ = await _user_with_two_accounts(sm, source_balance="100")
        with pytest.raises(ValueError, match="same account"):
            async with sm() as s:
                await TransferService(s).create(user_id, _body(source_id, source_id, "10"))

    run(scenario())


def test_transfer_amount_must_be_positive() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        user_id, source_id, dest_id = await _user_with_two_accounts(sm, source_balance="100")
        with pytest.raises(ValueError, match="positive"):
            async with sm() as s:
                await TransferService(s).create(user_id, _body(source_id, dest_id, "-5"))

    run(scenario())