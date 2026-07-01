"""Admin-only HTTP surface (`/v1/admin/*`).

Every route is gated by ``require_admin``. This is also the first place the
append-only audit trail (written by the transaction service) is exposed to
operators for review.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.rbac import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.admin import AdminUserRow, AuditEventRow, Page
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=Page[AdminUserRow])
async def list_users(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> Page[AdminUserRow]:
    rows, total = await admin_service.list_users(db, limit=limit, offset=offset)
    return Page[AdminUserRow](
        items=[AdminUserRow.model_validate(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/audit-events", response_model=Page[AuditEventRow])
async def list_audit_events(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    user_id: UUID | None = Query(None, description="Filter to a single user's events"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> Page[AuditEventRow]:
    rows, total = await admin_service.list_audit_events(
        db, limit=limit, offset=offset, user_id=user_id
    )
    return Page[AuditEventRow](
        items=[AuditEventRow.model_validate(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )
