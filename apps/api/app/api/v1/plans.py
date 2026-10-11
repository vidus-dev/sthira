"""Month plans (`/v1/plans/{year}/{month}`): each month's own list of bills and allowances."""

from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor, require_actor
from app.db.session import get_db
from app.modules.month_plans.schemas import (
    CarryBody,
    LineClose,
    LineCreate,
    LinePay,
    LineUpdate,
    MonthPlanRead,
    PlanUpdate,
)
from app.modules.month_plans.service import MonthPlanService

router = APIRouter(prefix="/plans", tags=["plans"])

Year = Path(ge=2000, le=2100)
Month = Path(ge=1, le=12)


def get_service(db: AsyncSession = Depends(get_db)) -> MonthPlanService:
    return MonthPlanService(db)


@router.get("/{year}/{month}", response_model=MonthPlanRead)
async def get_plan(
    year: int = Year,
    month: int = Month,
    actor: Actor = Depends(require_actor),
    svc: MonthPlanService = Depends(get_service),
) -> MonthPlanRead:
    """The month's plan, created from the repeating items the first time it's opened."""
    return await svc.get(actor, year, month)


@router.patch("/{year}/{month}", response_model=MonthPlanRead)
async def update_plan(
    body: PlanUpdate,
    year: int = Year,
    month: int = Month,
    actor: Actor = Depends(require_actor),
    svc: MonthPlanService = Depends(get_service),
) -> MonthPlanRead:
    """Set the salary the % items use (null = from salary entries) or mark it reviewed."""
    return await svc.update_plan(actor, year, month, body)


@router.post("/{year}/{month}/items", response_model=MonthPlanRead, status_code=201)
async def add_line(
    body: LineCreate,
    year: int = Year,
    month: int = Month,
    actor: Actor = Depends(require_actor),
    svc: MonthPlanService = Depends(get_service),
) -> MonthPlanRead:
    return await svc.add_line(actor, year, month, body)


@router.patch("/{year}/{month}/items/{item_id}", response_model=MonthPlanRead)
async def update_line(
    item_id: UUID,
    body: LineUpdate,
    year: int = Year,
    month: int = Month,
    actor: Actor = Depends(require_actor),
    svc: MonthPlanService = Depends(get_service),
) -> MonthPlanRead:
    """``scope: "month"`` changes only this month; ``"future"`` also the following ones."""
    return await svc.update_line(actor, year, month, item_id, body)


@router.delete("/{year}/{month}/items/{item_id}", response_model=MonthPlanRead)
async def delete_line(
    item_id: UUID,
    year: int = Year,
    month: int = Month,
    also_future: bool = Query(default=False, description="Stop it coming back next month too"),
    actor: Actor = Depends(require_actor),
    svc: MonthPlanService = Depends(get_service),
) -> MonthPlanRead:
    return await svc.delete_line(actor, year, month, item_id, also_future)


@router.post("/{year}/{month}/items/{item_id}/pay", response_model=MonthPlanRead)
async def pay_line(
    item_id: UUID,
    body: LinePay,
    year: int = Year,
    month: int = Month,
    actor: Actor = Depends(require_actor),
    svc: MonthPlanService = Depends(get_service),
) -> MonthPlanRead:
    """Pay a bill, or move an item's money to its bucket account."""
    return await svc.pay_line(actor, year, month, item_id, body)


@router.post("/{year}/{month}/items/{item_id}/close", response_model=MonthPlanRead)
async def close_line(
    item_id: UUID,
    body: LineClose,
    year: int = Year,
    month: int = Month,
    actor: Actor = Depends(require_actor),
    svc: MonthPlanService = Depends(get_service),
) -> MonthPlanRead:
    """Mark done by hand (or undo)."""
    return await svc.close_line(actor, year, month, item_id, body.closed)


@router.post("/{year}/{month}/carry", response_model=MonthPlanRead)
async def carry(
    body: CarryBody,
    year: int = Year,
    month: int = Month,
    actor: Actor = Depends(require_actor),
    svc: MonthPlanService = Depends(get_service),
) -> MonthPlanRead:
    """Last month's unpaid bill: move it into this month, or mark it done."""
    return await svc.carry(actor, year, month, body)
