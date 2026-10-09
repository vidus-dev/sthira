"""DB-backed tests for household categories."""

from __future__ import annotations

from app.modules.categories.schemas import CategoryCreate, CategoryUpdate
from app.modules.categories.service import CategoryService

from tests.integration.conftest import create_actor, make_sessionmaker, run


def test_create_gives_unique_slug_and_appends_to_the_end() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        async with sm() as s:
            existing = await CategoryService(s).list_categories(actor)
        async with sm() as s:
            dup = await CategoryService(s).create(actor, CategoryCreate(name="Food   delivery"))
            reserved = await CategoryService(s).create(actor, CategoryCreate(name="Transfer"))
            pets = await CategoryService(s).create(
                actor, CategoryCreate(name="Pets", icon="heart")
            )
        assert dup.name == "Food delivery"
        assert dup.slug == "food-delivery-2"  # "food-delivery" is a default
        assert reserved.slug == "transfer-2"
        assert pets.slug == "pets"
        assert pets.sort_order > max(c.sort_order for c in existing)

    run(scenario())


def test_rename_keeps_slug_and_archive_hides_from_list() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        async with sm() as s:
            cat = await CategoryService(s).create(actor, CategoryCreate(name="Swiggy"))
        async with sm() as s:
            renamed = await CategoryService(s).update(
                actor, cat.id, CategoryUpdate(name="Swiggy & Zomato")
            )
        assert renamed is not None
        assert (renamed.slug, renamed.name) == ("swiggy", "Swiggy & Zomato")

        async with sm() as s:
            assert await CategoryService(s).archive(actor, cat.id) is True
        async with sm() as s:
            visible = {c.slug for c in await CategoryService(s).list_categories(actor)}
            everything = {
                c.slug
                for c in await CategoryService(s).list_categories(actor, include_archived=True)
            }
        assert "swiggy" not in visible
        assert "swiggy" in everything

    run(scenario())


def test_categories_are_private_to_a_household() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        mine = await create_actor(sm)
        theirs = await create_actor(sm)
        async with sm() as s:
            cat = await CategoryService(s).create(mine, CategoryCreate(name="Temple"))
        async with sm() as s:
            assert await CategoryService(s).update(theirs, cat.id, CategoryUpdate(name="x")) is None
            assert await CategoryService(s).archive(theirs, cat.id) is False

    run(scenario())
