from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class TransferCreate(BaseModel):
    source_account_id: UUID
    dest_account_id: UUID
    amount: Decimal = Field(decimal_places=4, max_digits=19)
    description: str = Field(default="", max_length=512)
    occurred_at: datetime | None = None


class TransferRead(BaseModel):
    transfer_id: UUID
    source_account_id: UUID
    dest_account_id: UUID
    amount: Decimal
    occurred_at: datetime
    created_at: datetime
