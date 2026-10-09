"""Categories HTTP surface — delegates to ``CategoryService``."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor, require_actor
from app.db.session import get_db
from app.modules.categories.schemas import CategoryCreate, CategoryRead, CategoryUpdate
from app.modules.categories.service import CategoryService

router = APIRouter(prefix="/categories", tags=["categories"])


def get_category_service(db: AsyncSession = Depends(get_db)) -> CategoryService:
    return CategoryService(db)


@router.get("", response_model=list[CategoryRead])
async def list_categories(
    include_archived: bool = Query(default=False),
    actor: Actor = Depends(require_actor),
    svc: CategoryService = Depends(get_category_service),
) -> list[CategoryRead]:
    return await svc.list_categories(actor, include_archived=include_archived)


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CategoryCreate,
    actor: Actor = Depends(require_actor),
    svc: CategoryService = Depends(get_category_service),
) -> CategoryRead:
    return await svc.create(actor, body)


@router.patch("/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: UUID,
    body: CategoryUpdate,
    actor: Actor = Depends(require_actor),
    svc: CategoryService = Depends(get_category_service),
) -> CategoryRead:
    row = await svc.update(actor, category_id, body)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return row


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_category(
    category_id: UUID,
    actor: Actor = Depends(require_actor),
    svc: CategoryService = Depends(get_category_service),
) -> None:
    if not await svc.archive(actor, category_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
