from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor, require_actor
from app.db.session import get_db
from app.modules.budgets.schemas import BudgetCreate, BudgetRead, BudgetUpdate
from app.modules.budgets.service import BudgetService

router = APIRouter(prefix="/budgets", tags=["budgets"])


def get_budget_service(db: AsyncSession = Depends(get_db)) -> BudgetService:
    return BudgetService(db)


@router.get("", response_model=list[BudgetRead])
async def list_budgets(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    actor: Actor = Depends(require_actor),
    svc: BudgetService = Depends(get_budget_service),
) -> list[BudgetRead]:
    return await svc.list_month(actor, year, month)


@router.post("", response_model=BudgetRead, status_code=status.HTTP_201_CREATED)
async def upsert_budget(
    body: BudgetCreate,
    actor: Actor = Depends(require_actor),
    svc: BudgetService = Depends(get_budget_service),
) -> BudgetRead:
    try:
        return await svc.upsert(actor, body)
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Budget line already exists for this category and month",
        ) from None


@router.get("/{budget_id}", response_model=BudgetRead)
async def get_budget(
    budget_id: UUID,
    actor: Actor = Depends(require_actor),
    svc: BudgetService = Depends(get_budget_service),
) -> BudgetRead:
    row = await svc.get(actor, budget_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    return row


@router.patch("/{budget_id}", response_model=BudgetRead)
async def update_budget(
    budget_id: UUID,
    body: BudgetUpdate,
    actor: Actor = Depends(require_actor),
    svc: BudgetService = Depends(get_budget_service),
) -> BudgetRead:
    row = await svc.update(actor, budget_id, body)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    return row


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: UUID,
    actor: Actor = Depends(require_actor),
    svc: BudgetService = Depends(get_budget_service),
) -> None:
    ok = await svc.delete(actor, budget_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
