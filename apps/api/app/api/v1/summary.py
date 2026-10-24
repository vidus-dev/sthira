"""Read-only summaries for Home and Insights."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor, require_actor
from app.db.session import get_db
from app.modules.summary.schemas import BalanceHistory, MonthSummary, SavingsHistory
from app.modules.summary.service import SummaryService

router = APIRouter(prefix="/summary", tags=["summary"])


@router.get("/month", response_model=MonthSummary)
async def month_summary(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    actor: Actor = Depends(require_actor),
    db: AsyncSession = Depends(get_db),
) -> MonthSummary:
    return await SummaryService(db).month(actor, year, month)


@router.get("/balance-history", response_model=BalanceHistory)
async def balance_history(
    days: int = Query(90, ge=2, le=400),
    actor: Actor = Depends(require_actor),
    db: AsyncSession = Depends(get_db),
) -> BalanceHistory:
    """Total balance at the end of each day, for the line under Home's total."""
    return await SummaryService(db).balance_history(actor, days)


@router.get("/savings", response_model=SavingsHistory)
async def savings(
    months: int = Query(12, ge=1, le=36),
    actor: Actor = Depends(require_actor),
    db: AsyncSession = Depends(get_db),
) -> SavingsHistory:
    """Income, spending and what was kept, month by month (ending with this month)."""
    return await SummaryService(db).savings(actor, months)
