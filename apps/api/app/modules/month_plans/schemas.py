import re
from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.modules.monthly_payments.schemas import AmountType, ItemKind
from app.modules.transactions.schemas import TransactionRead

# handle@provider: letters, digits, dot, dash, underscore; the provider starts with a letter.
UPI_ID = re.compile(r"[a-z0-9._\-]{2,64}@[a-z][a-z0-9.\-]{1,32}")

# due / partly paid / paid (or set aside) / % item waiting for salary / amount not entered
# yet / an allowance with nothing to do but watch what's left.
LineStatus = Literal["due", "partial", "paid", "awaiting_income", "needs_amount", "tracking"]


class SalaryEntry(BaseModel):
    date: date
    amount: Decimal


class PlanSalary(BaseModel):
    """The salary the % items use: worked out from entries, unless set by hand."""

    auto: Decimal
    override: Decimal | None
    effective: Decimal
    entries: list[SalaryEntry]


class PlanLine(BaseModel):
    id: UUID
    template_id: UUID | None
    # Comes back next month (its repeating item is active).
    repeats: bool
    name: str
    category_slug: str
    kind: str
    amount_type: str
    amount: Decimal | None
    percent: Decimal | None
    covers_rest: bool
    dest_account_id: UUID | None
    default_account_id: UUID | None
    due_day: int | None
    due_date: date | None
    sort_order: int
    closed: bool
    carried_from_id: UUID | None
    notes: str | None
    payee_upi: str | None
    payee_name: str | None

    status: LineStatus
    due_amount: Decimal | None
    # Bills: paid so far. Allowances: moved into the bucket account so far.
    paid_amount: Decimal
    remaining: Decimal | None
    # Allowances: spent this month and what's left of the amount (negative = over).
    spent_amount: Decimal | None
    left_amount: Decimal | None
    # Hint for "changes every month" items: last month's amount.
    last_month_amount: Decimal | None
    payments: list[TransactionRead]


class BucketCheck(BaseModel):
    """Money set aside in an account but not spent yet, against what's in it now."""

    account_id: UUID
    balance: Decimal
    reserved: Decimal
    short: Decimal


class UnpaidLine(BaseModel):
    item_id: UUID
    name: str
    remaining: Decimal


class MonthPlanRead(BaseModel):
    year: int
    month: int
    exists: bool
    reviewed: bool
    salary: PlanSalary
    items: list[PlanLine]
    planned_total: Decimal
    done_total: Decimal
    settled_count: int
    total_count: int
    needs_amount_count: int
    buckets: list[BucketCheck]
    # Last month's bills still unpaid: move them here or mark them done.
    previous_unpaid: list[UnpaidLine]


class PlanUpdate(BaseModel):
    # null = use the salary entries again.
    salary_override: Decimal | None = Field(default=None, ge=0, decimal_places=4, max_digits=19)
    reviewed: bool | None = None


class LineFields(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    category_slug: str | None = Field(default=None, min_length=1, max_length=64)
    kind: ItemKind | None = None
    amount_type: AmountType | None = None
    amount: Decimal | None = Field(default=None, gt=0, decimal_places=4, max_digits=19)
    percent: Decimal | None = Field(default=None, gt=0, le=100, decimal_places=4, max_digits=7)
    covers_rest: bool | None = None
    dest_account_id: UUID | None = None
    default_account_id: UUID | None = None
    due_day: int | None = Field(default=None, ge=1, le=31)
    notes: str | None = Field(default=None, max_length=2000)
    # A UPI ID ("name@okicici", "98xxxxxx@ybl"); empty clears it.
    payee_upi: str | None = Field(default=None, max_length=100)
    payee_name: str | None = Field(default=None, max_length=80)

    @field_validator("payee_upi")
    @classmethod
    def _upi_id(cls, v: str | None) -> str | None:
        v = (v or "").strip().lower()
        if not v:
            return None
        if not UPI_ID.fullmatch(v):
            raise ValueError("Enter a UPI ID like name@okicici")
        return v

    @field_validator("payee_name")
    @classmethod
    def _blank_name(cls, v: str | None) -> str | None:
        return (v or "").strip() or None


class LineCreate(LineFields):
    name: str = Field(min_length=1, max_length=80)
    category_slug: str = Field(min_length=1, max_length=64)
    kind: ItemKind = "bill"
    amount_type: AmountType = "fixed"
    # Also add it to the following months (otherwise only this month).
    repeat: bool = True


class LineUpdate(LineFields):
    # "month": only this month. "future": this month and the following ones.
    scope: Literal["month", "future"] = "month"
    # false stops it coming back next month; true makes a one-off line repeat.
    repeat: bool | None = None


class LinePay(BaseModel):
    # Paid from / moved from. Defaults to the line's usual account.
    account_id: UUID | None = None
    # Defaults to what's still due.
    amount: Decimal | None = Field(default=None, gt=0, decimal_places=4, max_digits=19)
    occurred_at: datetime | None = None
    # Move it to the line's bucket account (default when it has one) instead of spending.
    move: bool | None = None
    description: str | None = Field(default=None, max_length=512)


class LineClose(BaseModel):
    closed: bool = True


class CarryBody(BaseModel):
    item_id: UUID  # a line in last month's plan
    action: Literal["move", "done"]
