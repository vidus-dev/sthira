from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

TxSource = Literal["manual", "sms", "ai"]


class TransactionCreate(BaseModel):
    account_id: UUID
    amount: Decimal = Field(decimal_places=4, max_digits=19)
    description: str = Field(default="", max_length=512)
    category_slug: str = Field(default="uncategorized", max_length=64)
    occurred_at: datetime
    notes: str | None = Field(default=None, max_length=4000)
    source: TxSource = "manual"
    # Import fingerprint (e.g. a hash of an SMS); the same ref is accepted once per household.
    source_ref: str | None = Field(default=None, min_length=1, max_length=128)
    # Pays a monthly plan item; ``period_month`` defaults to the month of ``occurred_at``.
    monthly_payment_id: UUID | None = None
    period_month: date | None = None


class TransactionUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, decimal_places=4, max_digits=19)
    description: str | None = Field(default=None, max_length=512)
    category_slug: str | None = Field(default=None, max_length=64)
    occurred_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=4000)
    # Send ``monthly_payment_id: null`` to unlink from the plan.
    monthly_payment_id: UUID | None = None
    period_month: date | None = None


class TransactionRead(BaseModel):
    id: UUID
    user_id: UUID
    household_id: UUID
    account_id: UUID
    amount: Decimal
    description: str
    category_slug: str
    occurred_at: datetime
    notes: str | None
    created_at: datetime
    transfer_id: UUID | None = None
    source: str = "manual"
    source_ref: str | None = None
    monthly_payment_id: UUID | None = None
    period_month: date | None = None

    model_config = {"from_attributes": True}
