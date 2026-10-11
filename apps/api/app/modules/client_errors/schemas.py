from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ClientErrorCreate(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    stack: str | None = Field(default=None, max_length=20000)
    fatal: bool = False
    app_version: str | None = Field(default=None, max_length=64)
    platform: str | None = Field(default=None, max_length=64)
    # Where it happened (screen, update id, ...). Never amounts or notes.
    context: dict[str, Any] | None = None
    occurred_at: datetime | None = None

    @field_validator("message")
    @classmethod
    def _trim(cls, v: str) -> str:
        return v[:1000]

    @field_validator("context")
    @classmethod
    def _small(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        if v is not None and len(str(v)) > 4000:
            raise ValueError("context is too large")
        return v


class ClientErrorAccepted(BaseModel):
    stored: bool


class ClientErrorRead(BaseModel):
    id: UUID
    user_id: UUID
    message: str
    stack: str | None
    fatal: bool
    app_version: str | None
    platform: str | None
    context: dict[str, Any] | None
    occurred_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}
