from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.modules.transactions.schemas import TransactionRead

AmountType = Literal["fixed", "percent", "variable"]
# A bill is paid; an allowance is money set aside and spent through the month.
ItemKind = Literal["bill", "allowance"]
PlanStatus = Literal["due", "partial", "paid", "awaiting_income"]

DEFAULT_BASE_CATEGORY = "salary"


def check_amounts(amount_type: str, amount: Decimal | None, percent: Decimal | None) -> None:
    """Shared rule for create and (merged) update."""
    if amount_type == "fixed" and (amount is None or amount <= 0):
        raise ValueError("A fixed payment needs an amount greater than 0")
    if amount_type == "percent" and (percent is None or not (0 < percent <= 100)):
        raise ValueError("A percent payment needs a percent between 0 and 100")


class MonthlyPaymentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    category_slug: str = Field(min_length=1, max_length=64)
    amount_type: AmountType = "fixed"
    amount: Decimal | None = Field(default=None, gt=0, decimal_places=4, max_digits=19)
    percent: Decimal | None = Field(default=None, gt=0, le=100, decimal_places=4, max_digits=7)
    base_category_slug: str | None = Field(default=None, min_length=1, max_length=64)
    default_account_id: UUID | None = None
    due_day: int | None = Field(default=None, ge=1, le=31)
    sort_order: int | None = Field(default=None, ge=0, le=10_000)
    notes: str | None = Field(default=None, max_length=2000)
    kind: ItemKind = "bill"
    dest_account_id: UUID | None = None
    covers_rest: bool = False

    @model_validator(mode="after")
    def _amounts(self) -> Self:
        check_amounts(self.amount_type, self.amount, self.percent)
        if self.amount_type == "percent" and self.base_category_slug is None:
            self.base_category_slug = DEFAULT_BASE_CATEGORY
        return self


class MonthlyPaymentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    category_slug: str | None = Field(default=None, min_length=1, max_length=64)
    amount_type: AmountType | None = None
    amount: Decimal | None = Field(default=None, gt=0, decimal_places=4, max_digits=19)
    percent: Decimal | None = Field(default=None, gt=0, le=100, decimal_places=4, max_digits=7)
    base_category_slug: str | None = Field(default=None, min_length=1, max_length=64)
    default_account_id: UUID | None = None
    due_day: int | None = Field(default=None, ge=1, le=31)
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0, le=10_000)
    notes: str | None = Field(default=None, max_length=2000)
    kind: ItemKind | None = None
    dest_account_id: UUID | None = None
    covers_rest: bool | None = None


class MonthlyPaymentRead(BaseModel):
    id: UUID
    name: str
    category_slug: str
    amount_type: str
    amount: Decimal | None
    percent: Decimal | None
    base_category_slug: str | None
    default_account_id: UUID | None
    due_day: int | None
    is_active: bool
    sort_order: int
    notes: str | None
    kind: str = "bill"
    dest_account_id: UUID | None = None
    covers_rest: bool = False

    model_config = {"from_attributes": True}


class PlanItemStatus(BaseModel):
    item: MonthlyPaymentRead
    status: PlanStatus
    due_amount: Decimal | None  # None for a variable item with no estimate
    base_amount: Decimal | None  # the income a percent item is computed from
    paid_amount: Decimal
    remaining: Decimal | None
    due_date: date | None
    payments: list[TransactionRead]


class MonthlyPlanStatus(BaseModel):
    year: int
    month: int
    items: list[PlanItemStatus]
    planned_total: Decimal
    paid_total: Decimal
    settled_count: int
    total_count: int
    base_income: dict[str, Decimal]


class PayRequest(BaseModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    account_id: UUID
    # Defaults to what's still due; required for a variable item without an estimate.
    amount: Decimal | None = Field(default=None, gt=0, decimal_places=4, max_digits=19)
    occurred_at: datetime | None = None
    description: str | None = Field(default=None, max_length=512)
    # Pay by moving money to one of our own accounts (a "bucket") instead of spending it.
    dest_account_id: UUID | None = None
