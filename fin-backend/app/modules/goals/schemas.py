from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

GoalKind = Literal["wedding", "emergency", "vacation", "custom"]


class FinancialGoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    goal_kind: GoalKind = "custom"
    currency: str = Field(default="INR", min_length=3, max_length=3)
    target_amount: Decimal = Field(gt=0, decimal_places=4, max_digits=19)
    saved_amount: Decimal = Field(default=Decimal("0"), ge=0, decimal_places=4, max_digits=19)
    target_date: date | None = None
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("currency")
    @classmethod
    def currency_upper(cls, v: str) -> str:
        return v.upper()


class FinancialGoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    goal_kind: GoalKind | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    target_amount: Decimal | None = Field(default=None, gt=0, decimal_places=4, max_digits=19)
    saved_amount: Decimal | None = Field(default=None, ge=0, decimal_places=4, max_digits=19)
    target_date: date | None = None
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("currency")
    @classmethod
    def currency_upper(cls, v: str | None) -> str | None:
        return v.upper() if v is not None else None


class FinancialGoalRead(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    goal_kind: str
    currency: str
    target_amount: Decimal
    saved_amount: Decimal
    target_date: date | None
    notes: str | None
    suggested_monthly_contribution: Decimal | None
    progress: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FinancialGoalPlan(BaseModel):
    remaining_amount: Decimal
    months_remaining: int | None
    suggested_monthly_contribution: Decimal | None
    progress: Decimal
