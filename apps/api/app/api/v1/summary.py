"""Read-only summaries for Home and Insights."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor, require_actor
from app.db.session import get_db
from app.modules.summary.schemas import MonthSummary
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
