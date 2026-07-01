from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.session_user import require_session_user_id
from app.db.session import get_db
from app.modules.budgets.schemas import BudgetCreate, BudgetRead, BudgetUpdate
from app.modules.budgets.service import BudgetService

router = APIRouter(prefix="/budgets", tags=["budgets"])


def get_budget_service(db: AsyncSession = Depends(get_db)) -> BudgetService:
    return BudgetService(db)


@router.get("", response_model=list[BudgetRead])
async def list_budgets(
    request: Request,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    svc: BudgetService = Depends(get_budget_service),
) -> list[BudgetRead]:
    uid = require_session_user_id(request)
    return await svc.list_month(uid, year, month)


@router.post("", response_model=BudgetRead, status_code=status.HTTP_201_CREATED)
async def upsert_budget(
    request: Request,
    body: BudgetCreate,
    svc: BudgetService = Depends(get_budget_service),
) -> BudgetRead:
    uid = require_session_user_id(request)
    try:
        return await svc.upsert(uid, body)
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Budget line already exists for this category and month",
        ) from None


@router.get("/{budget_id}", response_model=BudgetRead)
async def get_budget(
    request: Request,
    budget_id: UUID,
    svc: BudgetService = Depends(get_budget_service),
) -> BudgetRead:
    uid = require_session_user_id(request)
    row = await svc.get(uid, budget_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    return row


@router.patch("/{budget_id}", response_model=BudgetRead)
async def update_budget(
    request: Request,
    budget_id: UUID,
    body: BudgetUpdate,
    svc: BudgetService = Depends(get_budget_service),
) -> BudgetRead:
    uid = require_session_user_id(request)
    row = await svc.update(uid, budget_id, body)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    return row


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    request: Request,
    budget_id: UUID,
    svc: BudgetService = Depends(get_budget_service),
) -> None:
    uid = require_session_user_id(request)
    ok = await svc.delete(uid, budget_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
