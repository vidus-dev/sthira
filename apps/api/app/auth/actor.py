"""The authenticated caller and the household their data lives in.

Every data route depends on ``require_actor``: queries are scoped by
``actor.household_id`` (both members see the same rows) while ``actor.user_id``
records who created or changed something.
"""

from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.session_user import require_session_user_id
from app.db.session import get_db
from app.models.user import User


@dataclass(frozen=True, slots=True)
class Actor:
    user_id: UUID
    household_id: UUID


async def require_actor(request: Request, db: AsyncSession = Depends(get_db)) -> Actor:
    uid = require_session_user_id(request)
    household_id = await db.scalar(select(User.household_id).where(User.id == uid))
    # End the implicit read transaction so services can open their own with ``begin()``.
    await db.commit()
    if household_id is None:
        request.session.clear()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return Actor(user_id=uid, household_id=household_id)
