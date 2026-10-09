from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

CategoryKind = Literal["expense", "income"]


def _clean_name(v: str) -> str:
    v = " ".join(v.split())
    if not v:
        raise ValueError("name must not be blank")
    return v


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    kind: CategoryKind = "expense"
    icon: str = Field(default="dots", min_length=1, max_length=48)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        return _clean_name(v)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    icon: str | None = Field(default=None, min_length=1, max_length=48)
    sort_order: int | None = Field(default=None, ge=0, le=10_000)
    is_archived: bool | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        return _clean_name(v) if v is not None else None


class CategoryRead(BaseModel):
    id: UUID
    slug: str
    name: str
    kind: str
    icon: str
    sort_order: int
    is_archived: bool

    model_config = {"from_attributes": True}
