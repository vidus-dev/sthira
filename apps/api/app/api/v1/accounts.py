"""Accounts HTTP surface — delegates to ``AccountService``."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.session_user import require_session_user_id
from app.db.session import get_db
from app.modules.accounts.schemas import AccountCreate, AccountRead, AccountUpdate
from app.modules.accounts.service import AccountService

router = APIRouter(prefix="/accounts", tags=["accounts"])


def get_account_service(db: AsyncSession = Depends(get_db)) -> AccountService:
    return AccountService(db)


@router.get("", response_model=list[AccountRead])
async def list_accounts(
    request: Request,
    svc: AccountService = Depends(get_account_service),
) -> list[AccountRead]:
    uid = require_session_user_id(request)
    return await svc.list_accounts(uid)


@router.post("", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
async def create_account(
    request: Request,
    body: AccountCreate,
    svc: AccountService = Depends(get_account_service),
) -> AccountRead:
    uid = require_session_user_id(request)
    return await svc.create(uid, body)


@router.get("/{account_id}", response_model=AccountRead)
async def get_account(
    request: Request,
    account_id: UUID,
    svc: AccountService = Depends(get_account_service),
) -> AccountRead:
    uid = require_session_user_id(request)
    row = await svc.get(uid, account_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return row


@router.patch("/{account_id}", response_model=AccountRead)
async def update_account(
    request: Request,
    account_id: UUID,
    body: AccountUpdate,
    svc: AccountService = Depends(get_account_service),
) -> AccountRead:
    uid = require_session_user_id(request)
    row = await svc.update(uid, account_id, body)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return row


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    request: Request,
    account_id: UUID,
    svc: AccountService = Depends(get_account_service),
) -> None:
    uid = require_session_user_id(request)
    ok = await svc.delete(uid, account_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
