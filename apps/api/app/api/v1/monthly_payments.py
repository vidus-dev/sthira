"""Monthly plan HTTP surface — delegates to ``MonthlyPaymentService``."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor, require_actor
from app.db.session import get_db
from app.modules.monthly_payments.schemas import (
    MonthlyPaymentCreate,
    MonthlyPaymentRead,
    MonthlyPaymentUpdate,
    MonthlyPlanStatus,
    PayRequest,
    PlanItemStatus,
)
from app.modules.monthly_payments.service import MonthlyPaymentService

router = APIRouter(prefix="/monthly-payments", tags=["monthly-plan"])


def get_service(db: AsyncSession = Depends(get_db)) -> MonthlyPaymentService:
    return MonthlyPaymentService(db)


@router.get("", response_model=list[MonthlyPaymentRead])
async def list_items(
    include_inactive: bool = Query(default=False),
    actor: Actor = Depends(require_actor),
    svc: MonthlyPaymentService = Depends(get_service),
) -> list[MonthlyPaymentRead]:
    return await svc.list_items(actor, include_inactive=include_inactive)


@router.post("", response_model=MonthlyPaymentRead, status_code=status.HTTP_201_CREATED)
async def create_item(
    body: MonthlyPaymentCreate,
    actor: Actor = Depends(require_actor),
    svc: MonthlyPaymentService = Depends(get_service),
) -> MonthlyPaymentRead:
    return await svc.create(actor, body)


@router.get("/status", response_model=MonthlyPlanStatus)
async def plan_status(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    actor: Actor = Depends(require_actor),
    svc: MonthlyPaymentService = Depends(get_service),
) -> MonthlyPlanStatus:
    return await svc.status(actor, year, month)


@router.patch("/{item_id}", response_model=MonthlyPaymentRead)
async def update_item(
    item_id: UUID,
    body: MonthlyPaymentUpdate,
    actor: Actor = Depends(require_actor),
    svc: MonthlyPaymentService = Depends(get_service),
) -> MonthlyPaymentRead:
    row = await svc.update(actor, item_id, body)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monthly plan item not found")
    return row


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_item(
    item_id: UUID,
    actor: Actor = Depends(require_actor),
    svc: MonthlyPaymentService = Depends(get_service),
) -> None:
    if not await svc.archive(actor, item_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monthly plan item not found")


@router.post("/{item_id}/pay", response_model=PlanItemStatus, status_code=status.HTTP_201_CREATED)
async def pay_item(
    item_id: UUID,
    body: PayRequest,
    actor: Actor = Depends(require_actor),
    svc: MonthlyPaymentService = Depends(get_service),
) -> PlanItemStatus:
    return await svc.pay(actor, item_id, body)
