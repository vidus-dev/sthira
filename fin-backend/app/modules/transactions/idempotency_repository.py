"""Claim or replay idempotent POST /transactions."""

import json
import uuid
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.idempotency import IdempotencyKey

IDEMPOTENCY_SCOPE_TX_CREATE = "ledger_transaction.create"


class IdempotencyRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def claim_or_get_replay(
        self, user_id: UUID, scope: str, key: str
    ) -> tuple[IdempotencyKey, dict[str, Any] | None]:
        """Insert placeholder if missing, lock row, return (row, replay_body or None)."""
        stmt = (
            insert(IdempotencyKey)
            .values(
                id=uuid.uuid4(),
                user_id=user_id,
                scope=scope,
                key=key,
                response_json=None,
                http_status=201,
            )
            .on_conflict_do_nothing(
                index_elements=["user_id", "scope", "key"],
            )
        )
        await self._session.execute(stmt)
        await self._session.flush()

        r = await self._session.execute(
            select(IdempotencyKey)
            .where(
                IdempotencyKey.user_id == user_id,
                IdempotencyKey.scope == scope,
                IdempotencyKey.key == key,
            )
            .with_for_update()
        )
        row = r.scalar_one()
        if row.response_json:
            return row, json.loads(row.response_json)
        return row, None

    def attach_response(self, row: IdempotencyKey, body: dict[str, Any], http_status: int = 201) -> None:
        row.response_json = json.dumps(body, default=str)
        row.http_status = http_status
