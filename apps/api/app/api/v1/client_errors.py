"""Crash reports from the phone app (`/v1/client-errors`)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor, require_actor
from app.db.session import get_db
from app.modules.client_errors.schemas import ClientErrorAccepted, ClientErrorCreate
from app.modules.client_errors.service import record_client_error

router = APIRouter(prefix="/client-errors", tags=["client-errors"])


@router.post("", response_model=ClientErrorAccepted, status_code=status.HTTP_202_ACCEPTED)
async def report_client_error(
    body: ClientErrorCreate,
    actor: Actor = Depends(require_actor),
    db: AsyncSession = Depends(get_db),
) -> ClientErrorAccepted:
    return ClientErrorAccepted(stored=await record_client_error(db, actor, body))
