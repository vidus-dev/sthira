from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_event import AuditEvent


class AuditRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def append(
        self,
        *,
        user_id: UUID,
        action: str,
        entity_type: str,
        entity_id: UUID,
        payload: dict | None = None,
    ) -> None:
        self._session.add(
            AuditEvent(
                user_id=user_id,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                payload=payload,
            )
        )
        await self._session.flush()
