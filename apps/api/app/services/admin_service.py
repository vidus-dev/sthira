"""Read-only queries backing the admin surface.

These bypass per-user ownership scoping *by design* — they are only ever reached
through the ``require_admin`` gate (see ``app.auth.rbac``). Keep them read-only:
the audit trail is append-only and must not be mutated from the API.
"""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_event import AuditEvent
from app.models.user import User


async def list_users(
    db: AsyncSession, *, limit: int, offset: int
) -> tuple[list[User], int]:
    total = await db.scalar(select(func.count()).select_from(User))
    result = await db.execute(
        select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all()), int(total or 0)


async def list_audit_events(
    db: AsyncSession,
    *,
    limit: int,
    offset: int,
    user_id: UUID | None = None,
) -> tuple[list[AuditEvent], int]:
    count_stmt = select(func.count()).select_from(AuditEvent)
    rows_stmt = select(AuditEvent).order_by(AuditEvent.created_at.desc())
    if user_id is not None:
        count_stmt = count_stmt.where(AuditEvent.user_id == user_id)
        rows_stmt = rows_stmt.where(AuditEvent.user_id == user_id)

    total = await db.scalar(count_stmt)
    result = await db.execute(rows_stmt.limit(limit).offset(offset))
    return list(result.scalars().all()), int(total or 0)
