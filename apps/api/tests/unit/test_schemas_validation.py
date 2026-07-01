"""Validation tests for request schemas (pure Pydantic, no DB).

These lock in the domain input rules: currency normalization, positive-amount
constraints, bounded ranges, and decimal precision limits.
"""

from datetime import datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from app.modules.accounts.schemas import AccountCreate
from app.modules.budgets.schemas import BudgetCreate
from app.modules.goals.schemas import FinancialGoalCreate
from app.modules.transactions.schemas import TransactionCreate
from pydantic import ValidationError


class TestAccountCreate:
    def test_currency_is_uppercased(self) -> None:
        acct = AccountCreate(display_name="Main", currency="usd")
        assert acct.currency == "USD"

    def test_defaults(self) -> None:
        acct = AccountCreate(display_name="Main")
        assert acct.currency == "INR"
        assert acct.account_type == "checking"
        assert acct.balance == Decimal("0")
        assert acct.is_default is False

    def test_blank_display_name_rejected(self) -> None:
        with pytest.raises(ValidationError):
            AccountCreate(display_name="")

    def test_invalid_account_type_rejected(self) -> None:
        with pytest.raises(ValidationError):
            AccountCreate(display_name="Main", account_type="crypto")

    def test_currency_must_be_three_chars(self) -> None:
        with pytest.raises(ValidationError):
            AccountCreate(display_name="Main", currency="US")


class TestBudgetCreate:
    def _valid(self, **over):
        data = dict(category_slug="food", year=2026, month=6, limit_amount=Decimal("100"))
        data.update(over)
        return BudgetCreate(**data)

    def test_currency_uppercased(self) -> None:
        assert self._valid(currency="inr").currency == "INR"

    def test_limit_amount_must_be_positive(self) -> None:
        with pytest.raises(ValidationError):
            self._valid(limit_amount=Decimal("0"))

    @pytest.mark.parametrize("month", [0, 13])
    def test_month_out_of_range_rejected(self, month: int) -> None:
        with pytest.raises(ValidationError):
            self._valid(month=month)

    @pytest.mark.parametrize("year", [1999, 2101])
    def test_year_out_of_range_rejected(self, year: int) -> None:
        with pytest.raises(ValidationError):
            self._valid(year=year)


class TestFinancialGoalCreate:
    def test_currency_uppercased(self) -> None:
        goal = FinancialGoalCreate(name="Trip", target_amount=Decimal("1000"), currency="eur")
        assert goal.currency == "EUR"

    def test_target_amount_must_be_positive(self) -> None:
        with pytest.raises(ValidationError):
            FinancialGoalCreate(name="Trip", target_amount=Decimal("0"))

    def test_saved_amount_cannot_be_negative(self) -> None:
        with pytest.raises(ValidationError):
            FinancialGoalCreate(
                name="Trip", target_amount=Decimal("1000"), saved_amount=Decimal("-1")
            )

    def test_invalid_goal_kind_rejected(self) -> None:
        with pytest.raises(ValidationError):
            FinancialGoalCreate(name="Trip", target_amount=Decimal("1000"), goal_kind="yacht")


class TestTransactionCreate:
    def test_valid_transaction(self) -> None:
        tx = TransactionCreate(
            account_id=uuid4(),
            amount=Decimal("12.34"),
            occurred_at=datetime(2026, 6, 1, 12, 0, 0),
        )
        assert tx.category_slug == "uncategorized"
        assert tx.description == ""

    def test_too_many_decimal_places_rejected(self) -> None:
        with pytest.raises(ValidationError):
            TransactionCreate(
                account_id=uuid4(),
                amount=Decimal("1.123456"),  # > 4 decimal places
                occurred_at=datetime(2026, 6, 1),
            )

    def test_account_id_must_be_uuid(self) -> None:
        with pytest.raises(ValidationError):
            TransactionCreate(
                account_id="not-a-uuid",
                amount=Decimal("1"),
                occurred_at=datetime(2026, 6, 1),
            )

    def test_description_max_length_enforced(self) -> None:
        with pytest.raises(ValidationError):
            TransactionCreate(
                account_id=uuid4(),
                amount=Decimal("1"),
                description="x" * 513,
                occurred_at=datetime(2026, 6, 1),
            )
