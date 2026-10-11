"""Category use-cases. Categories are referenced by slug, so slugs never change."""

import re
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor
from app.models.category import Category
from app.modules.categories.schemas import CategoryCreate, CategoryRead, CategoryUpdate

# Slugs with a built-in meaning that user categories must not take.
# ``adjustment`` corrects a balance without counting as income or spending.
RESERVED_SLUGS = frozenset({"transfer", "uncategorized", "adjustment"})


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:56]
    return slug or "category"


class CategoryService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _get(self, actor: Actor, category_id: UUID) -> Category | None:
        return await self._session.scalar(
            select(Category).where(
                Category.id == category_id, Category.household_id == actor.household_id
            )
        )

    async def list_categories(
        self, actor: Actor, include_archived: bool = False
    ) -> list[CategoryRead]:
        q = select(Category).where(Category.household_id == actor.household_id)
        if not include_archived:
            q = q.where(Category.is_archived.is_(False))
        q = q.order_by(Category.kind, Category.sort_order, Category.name)
        rows = (await self._session.execute(q)).scalars().all()
        return [CategoryRead.model_validate(r) for r in rows]

    async def create(self, actor: Actor, body: CategoryCreate) -> CategoryRead:
        taken = set(
            (
                await self._session.execute(
                    select(Category.slug).where(Category.household_id == actor.household_id)
                )
            ).scalars()
        ) | RESERVED_SLUGS
        base = slugify(body.name)
        slug, n = base, 2
        while slug in taken:
            slug, n = f"{base}-{n}", n + 1
        next_sort = await self._session.scalar(
            select(func.coalesce(func.max(Category.sort_order), -1) + 1).where(
                Category.household_id == actor.household_id
            )
        )
        row = Category(
            household_id=actor.household_id,
            slug=slug,
            name=body.name,
            kind=body.kind,
            icon=body.icon,
            sort_order=next_sort,
        )
        self._session.add(row)
        await self._session.commit()
        await self._session.refresh(row)
        return CategoryRead.model_validate(row)

    async def update(
        self, actor: Actor, category_id: UUID, body: CategoryUpdate
    ) -> CategoryRead | None:
        row = await self._get(actor, category_id)
        if row is None:
            return None
        for key, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
            setattr(row, key, value)
        row.updated_at = datetime.now(UTC)
        await self._session.commit()
        await self._session.refresh(row)
        return CategoryRead.model_validate(row)

    async def archive(self, actor: Actor, category_id: UUID) -> bool:
        """Hide from pickers; entries keep showing the category by name."""
        row = await self._get(actor, category_id)
        if row is None:
            return False
        row.is_archived = True
        row.updated_at = datetime.now(UTC)
        await self._session.commit()
        return True
