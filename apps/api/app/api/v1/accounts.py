"""Accounts HTTP surface — delegates to ``AccountService``."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor, require_actor
from app.db.session import get_db
from app.modules.accounts.schemas import AccountCreate, AccountRead, AccountUpdate
from app.modules.accounts.service import AccountService

router = APIRouter(prefix="/accounts", tags=["accounts"])


def get_account_service(db: AsyncSession = Depends(get_db)) -> AccountService:
    return AccountService(db)


@router.get("", response_model=list[AccountRead])
async def list_accounts(
    actor: Actor = Depends(require_actor),
    svc: AccountService = Depends(get_account_service),
) -> list[AccountRead]:
    return await svc.list_accounts(actor)


@router.post("", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
async def create_account(
    body: AccountCreate,
    actor: Actor = Depends(require_actor),
    svc: AccountService = Depends(get_account_service),
) -> AccountRead:
    return await svc.create(actor, body)


@router.get("/{account_id}", response_model=AccountRead)
async def get_account(
    account_id: UUID,
    actor: Actor = Depends(require_actor),
    svc: AccountService = Depends(get_account_service),
) -> AccountRead:
    row = await svc.get(actor, account_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return row


@router.patch("/{account_id}", response_model=AccountRead)
async def update_account(
    account_id: UUID,
    body: AccountUpdate,
    actor: Actor = Depends(require_actor),
    svc: AccountService = Depends(get_account_service),
) -> AccountRead:
    row = await svc.update(actor, account_id, body)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return row


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: UUID,
    actor: Actor = Depends(require_actor),
    svc: AccountService = Depends(get_account_service),
) -> None:
    ok = await svc.delete(actor, account_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
