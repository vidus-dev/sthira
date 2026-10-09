"""Downloads of household data."""

from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor, require_actor
from app.db.session import get_db
from app.modules.export.service import transactions_csv

router = APIRouter(prefix="/export", tags=["export"])


@router.get(
    "/transactions.csv",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}, "description": "Every entry, oldest first"}},
)
async def export_transactions(
    actor: Actor = Depends(require_actor),
    db: AsyncSession = Depends(get_db),
) -> Response:
    body = await transactions_csv(db, actor)
    filename = f"sthira-entries-{date.today().isoformat()}.csv"
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
