from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.transactions.schemas import TxSource


class TransferCreate(BaseModel):
    source_account_id: UUID
    dest_account_id: UUID
    amount: Decimal = Field(decimal_places=4, max_digits=19)
    description: str = Field(default="", max_length=512)
    occurred_at: datetime | None = None
    # Moving money into a "bucket" account can settle a monthly plan item (e.g. setting
    # aside the 10%); the outgoing leg is linked to it.
    monthly_payment_id: UUID | None = None
    period_month: date | None = None
    # A month's plan line this funds (the outgoing leg is linked).
    plan_item_id: UUID | None = None
    # Imports (e.g. a debit SMS and the matching credit SMS) dedupe each leg separately.
    source: TxSource = "manual"
    source_ref: str | None = Field(default=None, min_length=1, max_length=128)
    dest_source_ref: str | None = Field(default=None, min_length=1, max_length=128)


class TransferRead(BaseModel):
    transfer_id: UUID
    source_account_id: UUID
    dest_account_id: UUID
    amount: Decimal
    occurred_at: datetime
    created_at: datetime
    debit_transaction_id: UUID | None = None
    credit_transaction_id: UUID | None = None
