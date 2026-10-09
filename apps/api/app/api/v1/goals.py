from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor, require_actor
from app.db.session import get_db
from app.modules.goals import calculator
from app.modules.goals.schemas import (
    FinancialGoalCreate,
    FinancialGoalPlan,
    FinancialGoalRead,
    FinancialGoalUpdate,
)
from app.modules.goals.service import GoalService

router = APIRouter(prefix="/goals", tags=["goals"])


def get_goal_service(db: AsyncSession = Depends(get_db)) -> GoalService:
    return GoalService(db)


@router.get("", response_model=list[FinancialGoalRead])
async def list_goals(
    actor: Actor = Depends(require_actor),
    svc: GoalService = Depends(get_goal_service),
) -> list[FinancialGoalRead]:
    return await svc.list_goals(actor)


@router.post("", response_model=FinancialGoalRead, status_code=status.HTTP_201_CREATED)
async def create_goal(
    body: FinancialGoalCreate,
    actor: Actor = Depends(require_actor),
    svc: GoalService = Depends(get_goal_service),
) -> FinancialGoalRead:
    try:
        return await svc.create_goal(actor, body)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get("/{goal_id}", response_model=FinancialGoalRead)
async def get_goal(
    goal_id: UUID,
    actor: Actor = Depends(require_actor),
    svc: GoalService = Depends(get_goal_service),
) -> FinancialGoalRead:
    row = await svc.get_goal(actor, goal_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return row


@router.get("/{goal_id}/plan", response_model=FinancialGoalPlan)
async def get_goal_plan(
    goal_id: UUID,
    actor: Actor = Depends(require_actor),
    svc: GoalService = Depends(get_goal_service),
) -> FinancialGoalPlan:
    row = await svc.get_goal(actor, goal_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")

    today = date.today()
    months = (
        calculator.whole_months_between(today, row.target_date)
        if row.target_date
        else None
    )
    suggested = calculator.suggested_monthly_contribution(
        row.target_amount, row.saved_amount, row.target_date, today=today
    )
    remaining = calculator.remaining_to_target(row.target_amount, row.saved_amount)
    prog = calculator.progress_ratio(row.target_amount, row.saved_amount)
    return FinancialGoalPlan(
        remaining_amount=remaining,
        months_remaining=months,
        suggested_monthly_contribution=suggested,
        progress=prog,
    )


@router.patch("/{goal_id}", response_model=FinancialGoalRead)
async def update_goal(
    goal_id: UUID,
    body: FinancialGoalUpdate,
    actor: Actor = Depends(require_actor),
    svc: GoalService = Depends(get_goal_service),
) -> FinancialGoalRead:
    try:
        row = await svc.update_goal(actor, goal_id, body)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return row


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: UUID,
    actor: Actor = Depends(require_actor),
    svc: GoalService = Depends(get_goal_service),
) -> None:
    ok = await svc.delete_goal(actor, goal_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
