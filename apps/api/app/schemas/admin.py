"""Schemas for the admin-only surface (`/v1/admin/*`)."""

from datetime import datetime
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Offset/limit page envelope with a total count for client paging."""

    items: list[T]
    total: int
    limit: int
    offset: int


class AdminUserRow(BaseModel):
    id: UUID
    email: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditEventRow(BaseModel):
    id: UUID
    user_id: UUID
    action: str
    entity_type: str
    entity_id: UUID
    payload: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
