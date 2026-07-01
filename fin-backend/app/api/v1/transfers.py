"""Transfers HTTP surface — delegates to ``TransferService``."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.session_user import require_session_user_id
from app.db.session import get_db
from app.modules.transfers.schemas import TransferCreate, TransferRead
from app.modules.transfers.service import TransferService

router = APIRouter(prefix="/transfers", tags=["transfers"])


def get_transfer_service(db: AsyncSession = Depends(get_db)) -> TransferService:
    return TransferService(db)


@router.post("", response_model=TransferRead, status_code=status.HTTP_201_CREATED)
async def create_transfer(
    request: Request,
    body: TransferCreate,
    svc: TransferService = Depends(get_transfer_service),
) -> TransferRead:
    uid = require_session_user_id(request)
    return await svc.create(uid, body)
