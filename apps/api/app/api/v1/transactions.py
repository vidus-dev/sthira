from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor, require_actor
from app.db.session import get_db
from app.modules.transactions.repository import TransactionFilter
from app.modules.transactions.schemas import TransactionCreate, TransactionRead, TransactionUpdate
from app.modules.transactions.service import TransactionService

router = APIRouter(prefix="/transactions", tags=["transactions"])


def get_transaction_service(db: AsyncSession = Depends(get_db)) -> TransactionService:
    return TransactionService(db)


@router.get("", response_model=list[TransactionRead])
async def list_transactions(
    account_id: UUID | None = Query(default=None),
    start: datetime | None = Query(default=None, description="Inclusive lower bound on occurred_at"),
    end: datetime | None = Query(default=None, description="Exclusive upper bound on occurred_at"),
    category_slug: str | None = Query(default=None, max_length=64),
    monthly_payment_id: UUID | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1, le=2000),
    actor: Actor = Depends(require_actor),
    svc: TransactionService = Depends(get_transaction_service),
) -> list[TransactionRead]:
    f = TransactionFilter(
        account_id=account_id,
        start=start,
        end=end,
        category_slug=category_slug,
        monthly_payment_id=monthly_payment_id,
        limit=limit,
    )
    return await svc.list_transactions(actor, f)


@router.post("", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    body: TransactionCreate,
    actor: Actor = Depends(require_actor),
    svc: TransactionService = Depends(get_transaction_service),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> TransactionRead:
    key = (idempotency_key or "").strip()
    if len(key) > 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Idempotency-Key must be at most 255 characters",
        )
    return await svc.create(actor, body, key or None)


@router.get("/{tx_id}", response_model=TransactionRead)
async def get_transaction(
    tx_id: UUID,
    actor: Actor = Depends(require_actor),
    svc: TransactionService = Depends(get_transaction_service),
) -> TransactionRead:
    row = await svc.get(actor, tx_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return row


@router.patch("/{tx_id}", response_model=TransactionRead)
async def update_transaction(
    tx_id: UUID,
    body: TransactionUpdate,
    actor: Actor = Depends(require_actor),
    svc: TransactionService = Depends(get_transaction_service),
) -> TransactionRead:
    row = await svc.update(actor, tx_id, body)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return row


@router.delete("/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    tx_id: UUID,
    actor: Actor = Depends(require_actor),
    svc: TransactionService = Depends(get_transaction_service),
) -> None:
    ok = await svc.delete(actor, tx_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
