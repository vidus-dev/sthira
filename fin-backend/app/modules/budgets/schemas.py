from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class BudgetCreate(BaseModel):
    category_slug: str = Field(min_length=1, max_length=64)
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    limit_amount: Decimal = Field(gt=0, decimal_places=4, max_digits=19)
    currency: str = Field(default="INR", min_length=3, max_length=3)

    @field_validator("currency")
    @classmethod
    def up(cls, v: str) -> str:
        return v.upper()


class BudgetUpdate(BaseModel):
    limit_amount: Decimal | None = Field(default=None, gt=0, decimal_places=4, max_digits=19)
    currency: str | None = Field(default=None, min_length=3, max_length=3)

    @field_validator("currency")
    @classmethod
    def up(cls, v: str | None) -> str | None:
        return v.upper() if v is not None else None


class BudgetRead(BaseModel):
    id: UUID
    user_id: UUID
    category_slug: str
    year: int
    month: int
    limit_amount: Decimal
    currency: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
