from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.session_user import require_session_user_id
from app.db.session import get_db
from app.modules.transactions.schemas import TransactionCreate, TransactionRead, TransactionUpdate
from app.modules.transactions.service import TransactionService

router = APIRouter(prefix="/transactions", tags=["transactions"])


def get_transaction_service(db: AsyncSession = Depends(get_db)) -> TransactionService:
    return TransactionService(db)


@router.get("", response_model=list[TransactionRead])
async def list_transactions(
    request: Request,
    account_id: UUID | None = Query(default=None),
    svc: TransactionService = Depends(get_transaction_service),
) -> list[TransactionRead]:
    uid = require_session_user_id(request)
    return await svc.list_transactions(uid, account_id=account_id)


@router.post("", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    request: Request,
    body: TransactionCreate,
    svc: TransactionService = Depends(get_transaction_service),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> TransactionRead:
    uid = require_session_user_id(request)
    key = (idempotency_key or "").strip()
    if len(key) > 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Idempotency-Key must be at most 255 characters",
        )
    return await svc.create(uid, body, key or None)


@router.get("/{tx_id}", response_model=TransactionRead)
async def get_transaction(
    request: Request,
    tx_id: UUID,
    svc: TransactionService = Depends(get_transaction_service),
) -> TransactionRead:
    uid = require_session_user_id(request)
    row = await svc.get(uid, tx_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return row


@router.patch("/{tx_id}", response_model=TransactionRead)
async def update_transaction(
    request: Request,
    tx_id: UUID,
    body: TransactionUpdate,
    svc: TransactionService = Depends(get_transaction_service),
) -> TransactionRead:
    uid = require_session_user_id(request)
    row = await svc.update(uid, tx_id, body)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return row


@router.delete("/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    request: Request,
    tx_id: UUID,
    svc: TransactionService = Depends(get_transaction_service),
) -> None:
    uid = require_session_user_id(request)
    ok = await svc.delete(uid, tx_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
