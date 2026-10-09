"""Transfers HTTP surface — delegates to ``TransferService``."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor, require_actor
from app.db.session import get_db
from app.modules.transfers.schemas import TransferCreate, TransferRead
from app.modules.transfers.service import TransferService

router = APIRouter(prefix="/transfers", tags=["transfers"])


def get_transfer_service(db: AsyncSession = Depends(get_db)) -> TransferService:
    return TransferService(db)


@router.post("", response_model=TransferRead, status_code=status.HTTP_201_CREATED)
async def create_transfer(
    body: TransferCreate,
    actor: Actor = Depends(require_actor),
    svc: TransferService = Depends(get_transfer_service),
) -> TransferRead:
    return await svc.create(actor, body)
