from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.session_user import require_session_user_id
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
    request: Request,
    svc: GoalService = Depends(get_goal_service),
) -> list[FinancialGoalRead]:
    uid = require_session_user_id(request)
    return await svc.list_goals(uid)


@router.post("", response_model=FinancialGoalRead, status_code=status.HTTP_201_CREATED)
async def create_goal(
    request: Request,
    body: FinancialGoalCreate,
    svc: GoalService = Depends(get_goal_service),
) -> FinancialGoalRead:
    uid = require_session_user_id(request)
    try:
        return await svc.create_goal(uid, body)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get("/{goal_id}", response_model=FinancialGoalRead)
async def get_goal(
    request: Request,
    goal_id: UUID,
    svc: GoalService = Depends(get_goal_service),
) -> FinancialGoalRead:
    uid = require_session_user_id(request)
    row = await svc.get_goal(uid, goal_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return row


@router.get("/{goal_id}/plan", response_model=FinancialGoalPlan)
async def get_goal_plan(
    request: Request,
    goal_id: UUID,
    svc: GoalService = Depends(get_goal_service),
) -> FinancialGoalPlan:
    uid = require_session_user_id(request)
    row = await svc.get_goal(uid, goal_id)
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
    request: Request,
    goal_id: UUID,
    body: FinancialGoalUpdate,
    svc: GoalService = Depends(get_goal_service),
) -> FinancialGoalRead:
    uid = require_session_user_id(request)
    try:
        row = await svc.update_goal(uid, goal_id, body)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return row


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    request: Request,
    goal_id: UUID,
    svc: GoalService = Depends(get_goal_service),
) -> None:
    uid = require_session_user_id(request)
    ok = await svc.delete_goal(uid, goal_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
