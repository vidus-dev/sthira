"""Unit tests for the pure goal-planning math (no I/O)."""

from datetime import date
from decimal import Decimal

import pytest
from app.modules.goals.calculator import (
    progress_ratio,
    remaining_to_target,
    suggested_monthly_contribution,
    whole_months_between,
)


class TestWholeMonthsBetween:
    def test_same_date_is_zero(self) -> None:
        assert whole_months_between(date(2026, 1, 15), date(2026, 1, 15)) == 0

    def test_end_before_start_is_zero(self) -> None:
        assert whole_months_between(date(2026, 6, 1), date(2026, 1, 1)) == 0

    def test_full_months(self) -> None:
        assert whole_months_between(date(2026, 1, 10), date(2026, 4, 10)) == 3

    def test_partial_month_not_counted(self) -> None:
        # 10 Jan -> 9 Feb is not a whole month
        assert whole_months_between(date(2026, 1, 10), date(2026, 2, 9)) == 0

    def test_crosses_year_boundary(self) -> None:
        assert whole_months_between(date(2025, 11, 1), date(2026, 2, 1)) == 3


class TestRemainingToTarget:
    def test_positive_remaining(self) -> None:
        assert remaining_to_target(Decimal("1000"), Decimal("250")) == Decimal("750")

    def test_overfunded_is_negative(self) -> None:
        assert remaining_to_target(Decimal("100"), Decimal("150")) == Decimal("-50")


class TestSuggestedMonthlyContribution:
    def test_open_ended_goal_returns_none(self) -> None:
        result = suggested_monthly_contribution(
            Decimal("1000"), Decimal("0"), None, today=date(2026, 1, 1)
        )
        assert result is None

    def test_already_met_returns_zero(self) -> None:
        result = suggested_monthly_contribution(
            Decimal("1000"), Decimal("1000"), date(2026, 12, 1), today=date(2026, 1, 1)
        )
        assert result == Decimal("0")

    def test_divides_remaining_over_months(self) -> None:
        # 1200 remaining over 12 whole months -> 100/mo
        result = suggested_monthly_contribution(
            Decimal("1200"), Decimal("0"), date(2027, 1, 1), today=date(2026, 1, 1)
        )
        assert result == Decimal("100.00")

    def test_no_months_left_requires_full_remaining(self) -> None:
        # target date already here -> must contribute the whole remaining now
        result = suggested_monthly_contribution(
            Decimal("500"), Decimal("100"), date(2026, 1, 1), today=date(2026, 1, 1)
        )
        assert result == Decimal("400.00")

    def test_result_is_quantized_to_cents(self) -> None:
        result = suggested_monthly_contribution(
            Decimal("1000"), Decimal("0"), date(2026, 4, 1), today=date(2026, 1, 1)
        )
        assert result is not None
        assert result == Decimal("333.33")


class TestProgressRatio:
    def test_zero_target_returns_zero(self) -> None:
        assert progress_ratio(Decimal("0"), Decimal("50")) == Decimal("0")

    def test_half_progress(self) -> None:
        assert progress_ratio(Decimal("200"), Decimal("100")) == Decimal("0.5000")

    def test_capped_at_one_when_overfunded(self) -> None:
        assert progress_ratio(Decimal("100"), Decimal("250")) == Decimal("1")

    @pytest.mark.parametrize(
        ("target", "saved", "expected"),
        [
            (Decimal("3"), Decimal("1"), Decimal("0.3333")),
            (Decimal("8"), Decimal("1"), Decimal("0.1250")),
        ],
    )
    def test_quantized_to_four_places(
        self, target: Decimal, saved: Decimal, expected: Decimal
    ) -> None:
        assert progress_ratio(target, saved) == expected
