from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

# checking = bank current account, savings = bank savings account, credit = credit card.
AccountType = Literal["checking", "savings", "credit", "cash", "wallet", "investment"]


class AccountCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=255)
    institution: str | None = Field(default=None, max_length=255)
    account_type: AccountType = "checking"
    currency: str = Field(default="INR", min_length=3, max_length=3)
    balance: Decimal = Field(default=Decimal("0"), decimal_places=4, max_digits=19)
    mask_last4: str | None = Field(default=None, max_length=4)
    color_token: str | None = Field(default=None, max_length=64)
    is_default: bool = False
    owner_user_id: UUID | None = None  # None = joint

    @field_validator("currency")
    @classmethod
    def upper_ccy(cls, v: str) -> str:
        return v.upper()


class AccountUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    institution: str | None = Field(default=None, max_length=255)
    account_type: AccountType | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    balance: Decimal | None = Field(default=None, decimal_places=4, max_digits=19)
    mask_last4: str | None = Field(default=None, max_length=4)
    color_token: str | None = Field(default=None, max_length=64)
    is_default: bool | None = None
    owner_user_id: UUID | None = None

    @field_validator("currency")
    @classmethod
    def upper_ccy(cls, v: str | None) -> str | None:
        return v.upper() if v is not None else None


class AccountRead(BaseModel):
    id: UUID
    user_id: UUID
    household_id: UUID
    owner_user_id: UUID | None
    display_name: str
    institution: str | None
    account_type: str
    currency: str
    balance: Decimal
    mask_last4: str | None
    color_token: str | None
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReconcileBody(BaseModel):
    """The balance the bank (or wallet, or cash in hand) shows right now."""

    balance: Decimal = Field(decimal_places=4, max_digits=19)
    # A shortfall counts as spending ("Unaccounted") unless ``as_spending`` is false, in
    # which case it only corrects the balance. A surplus always only corrects it.
    as_spending: bool = True
    occurred_at: datetime | None = None
    note: str | None = Field(default=None, max_length=512)


class ReconcileResult(BaseModel):
    account: AccountRead
    # The entry that explains the difference; null when the balance already matched.
    transaction_id: UUID | None = None
    difference: Decimal
