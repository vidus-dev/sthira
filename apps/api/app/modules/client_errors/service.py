"""Store app crash reports (capped per user so a crash loop can't flood the table)."""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor
from app.models.client_error import ClientError
from app.modules.client_errors.schemas import ClientErrorCreate

logger = logging.getLogger(__name__)

MAX_PER_HOUR = 30


async def record_client_error(session: AsyncSession, actor: Actor, body: ClientErrorCreate) -> bool:
    now = datetime.now(UTC)
    recent = await session.scalar(
        select(func.count())
        .select_from(ClientError)
        .where(ClientError.user_id == actor.user_id, ClientError.created_at > now - timedelta(hours=1))
    )
    logger.warning(
        "client error",
        extra={
            "user_id": str(actor.user_id),
            "fatal": body.fatal,
            "app_version": body.app_version,
            "client_message": body.message[:300],
        },
    )
    if (recent or 0) >= MAX_PER_HOUR:
        return False
    session.add(
        ClientError(
            user_id=actor.user_id,
            message=body.message,
            stack=body.stack,
            fatal=body.fatal,
            app_version=body.app_version,
            platform=body.platform,
            context=body.context,
            occurred_at=body.occurred_at or now,
        )
    )
    await session.commit()
    return True


async def list_client_errors(session: AsyncSession, limit: int) -> list[ClientError]:
    rows = await session.execute(
        select(ClientError).order_by(ClientError.created_at.desc()).limit(limit)
    )
    return list(rows.scalars())
