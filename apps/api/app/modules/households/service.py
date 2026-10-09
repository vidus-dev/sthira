"""Household use-cases: create on sign-up, read, rename, join by invite code."""

from uuid import UUID

from sqlalchemy import delete, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor
from app.models.account import FinancialAccount
from app.models.category import Category
from app.models.household import Household
from app.models.transaction import LedgerTransaction
from app.models.user import User
from app.modules.errors import ConflictError, NotFoundError
from app.modules.households.defaults import (
    DEFAULT_CATEGORIES,
    new_invite_code,
    normalize_invite_code,
)
from app.modules.households.schemas import HouseholdMember, HouseholdRead


class HouseholdConflictError(ConflictError):
    """The requested household change would merge or orphan data."""


async def create_household(session: AsyncSession, name: str = "Our home") -> Household:
    """Insert a household with default categories (no commit)."""
    household = Household(name=name, invite_code=await _unused_invite_code(session))
    session.add(household)
    await session.flush()
    session.add_all(
        Category(
            household_id=household.id, slug=slug, name=label, kind=kind, icon=icon, sort_order=i
        )
        for i, (slug, label, kind, icon) in enumerate(DEFAULT_CATEGORIES)
    )
    await session.flush()
    return household


async def _unused_invite_code(session: AsyncSession) -> str:
    while True:
        code = new_invite_code()
        taken = await session.scalar(select(exists().where(Household.invite_code == code)))
        if not taken:
            return code


class HouseholdService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _read(self, household: Household) -> HouseholdRead:
        members = (
            await self._session.execute(
                select(User).where(User.household_id == household.id).order_by(User.created_at)
            )
        ).scalars().all()
        return HouseholdRead(
            id=household.id,
            name=household.name,
            currency=household.currency,
            timezone=household.timezone,
            invite_code=household.invite_code,
            members=[HouseholdMember.model_validate(m) for m in members],
        )

    async def get(self, actor: Actor) -> HouseholdRead:
        household = await self._session.get(Household, actor.household_id)
        assert household is not None  # a user always belongs to a household
        return await self._read(household)

    async def rename(self, actor: Actor, name: str) -> HouseholdRead:
        household = await self._session.get(Household, actor.household_id)
        assert household is not None
        household.name = name
        await self._session.commit()
        return await self._read(household)

    async def rotate_invite_code(self, actor: Actor) -> HouseholdRead:
        household = await self._session.get(Household, actor.household_id)
        assert household is not None
        household.invite_code = await _unused_invite_code(self._session)
        await self._session.commit()
        return await self._read(household)

    async def join(self, actor: Actor, invite_code: str) -> HouseholdRead:
        """Move the caller into the household with ``invite_code``.

        Allowed only from a household that the caller has to themselves and that holds
        no accounts or transactions, so joining never merges or strands real data. The
        abandoned household (default categories, empty plan) is deleted.
        """
        code = normalize_invite_code(invite_code)
        target = await self._session.scalar(select(Household).where(Household.invite_code == code))
        if target is None:
            raise NotFoundError("No household found for that invite code")
        if target.id == actor.household_id:
            return await self._read(target)

        old_id = actor.household_id
        member_count = await self._session.scalar(
            select(func.count()).select_from(User).where(User.household_id == old_id)
        )
        has_data = await self._session.scalar(
            select(
                exists().where(FinancialAccount.household_id == old_id)
                | exists().where(LedgerTransaction.household_id == old_id)
            )
        )
        if member_count and member_count > 1:
            raise HouseholdConflictError("Others share your current household; it can't be left")
        if has_data:
            raise HouseholdConflictError(
                "Your current household already has accounts or entries. "
                "Join from a new account instead."
            )

        user = await self._session.get(User, actor.user_id)
        assert user is not None
        user.household_id = target.id
        await self._session.flush()
        await self._session.execute(delete(Household).where(Household.id == old_id))
        await self._session.commit()
        return await self._read(target)


async def member_ids(session: AsyncSession, household_id: UUID) -> set[UUID]:
    rows = await session.execute(select(User.id).where(User.household_id == household_id))
    return set(rows.scalars().all())
