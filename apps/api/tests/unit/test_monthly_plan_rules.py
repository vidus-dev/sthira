"""Pure rules: plan maths, month boundaries in India, slugs and invite codes."""

from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from app.modules.categories.service import slugify
from app.modules.households.defaults import new_invite_code, normalize_invite_code
from app.modules.monthly_payments import calculator
from app.modules.periods import add_months, month_bounds, period_for


class TestDueAmount:
    def test_percent_of_salary_rounds_to_paise(self) -> None:
        assert calculator.due_amount("percent", None, Decimal("10"), Decimal("85000")) == Decimal(
            "8500.00"
        )
        assert calculator.due_amount("percent", None, Decimal("5"), Decimal("33333.33")) == Decimal(
            "1666.67"
        )

    def test_percent_without_income_is_zero(self) -> None:
        assert calculator.due_amount("percent", None, Decimal("10"), None) == Decimal("0.00")

    def test_fixed_and_variable(self) -> None:
        assert calculator.due_amount("fixed", Decimal("18000"), None, None) == Decimal("18000")
        assert calculator.due_amount("variable", None, None, None) is None
        assert calculator.due_amount("variable", Decimal("1400"), None, None) == Decimal("1400")


class TestStatus:
    @pytest.mark.parametrize(
        ("amount_type", "due", "paid", "base", "expected"),
        [
            ("fixed", Decimal("100"), Decimal("0"), None, "due"),
            ("fixed", Decimal("100"), Decimal("40"), None, "partial"),
            ("fixed", Decimal("100"), Decimal("100"), None, "paid"),
            ("fixed", Decimal("100"), Decimal("120"), None, "paid"),
            ("percent", Decimal("0"), Decimal("0"), Decimal("0"), "awaiting_income"),
            ("percent", Decimal("8500"), Decimal("0"), Decimal("85000"), "due"),
            ("variable", None, Decimal("0"), None, "due"),
            ("variable", None, Decimal("1400"), None, "paid"),
            ("variable", Decimal("1400"), Decimal("1200"), None, "paid"),  # estimate only
        ],
    )
    def test_status(self, amount_type, due, paid, base, expected) -> None:
        assert calculator.plan_status(amount_type, due, paid, base) == expected

    def test_remaining_never_negative(self) -> None:
        assert calculator.remaining(Decimal("100"), Decimal("130")) == Decimal("0")
        assert calculator.remaining(None, Decimal("5")) is None

    def test_due_date_clamps_to_month_end(self) -> None:
        assert calculator.due_date(2026, 2, 31) == date(2026, 2, 28)
        assert calculator.due_date(2028, 2, 30) == date(2028, 2, 29)
        assert calculator.due_date(2026, 10, None) is None


class TestPeriods:
    def test_month_bounds_in_india(self) -> None:
        start, end = month_bounds(2026, 10, "Asia/Kolkata")
        assert start.astimezone(UTC) == datetime(2026, 9, 30, 18, 30, tzinfo=UTC)
        assert end.astimezone(UTC) == datetime(2026, 10, 31, 18, 30, tzinfo=UTC)

    def test_december_rolls_into_next_year(self) -> None:
        _, end = month_bounds(2026, 12, "Asia/Kolkata")
        assert (end.year, end.month) == (2027, 1)
        assert add_months(date(2026, 1, 31), -1) == date(2025, 12, 1)
        assert add_months(date(2026, 11, 15), 3) == date(2027, 2, 1)

    def test_late_night_utc_is_next_day_locally(self) -> None:
        assert period_for(datetime(2026, 9, 30, 19, 0, tzinfo=UTC), "Asia/Kolkata") == date(
            2026, 10, 1
        )
        assert period_for(datetime(2026, 9, 30, 19, 0), "Asia/Kolkata") == date(2026, 10, 1)


class TestNames:
    @pytest.mark.parametrize(
        ("name", "slug"),
        [("Food delivery", "food-delivery"), ("Swiggy & Zomato!", "swiggy-zomato"), ("₹₹", "category")],
    )
    def test_slugify(self, name: str, slug: str) -> None:
        assert slugify(name) == slug

    def test_invite_codes(self) -> None:
        code = new_invite_code()
        assert len(code) == 9 and code[4] == "-"
        assert not set(code) & set("01OI")
        assert normalize_invite_code(" k7qm 4ztx ") == "K7QM-4ZTX"
        assert normalize_invite_code(code.lower().replace("-", "")) == code
