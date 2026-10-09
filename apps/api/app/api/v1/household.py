"""Household HTTP surface: members, name, invite code, joining."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor, require_actor
from app.db.session import get_db
from app.modules.households.schemas import HouseholdJoin, HouseholdRead, HouseholdUpdate
from app.modules.households.service import HouseholdService

router = APIRouter(prefix="/household", tags=["household"])


def get_household_service(db: AsyncSession = Depends(get_db)) -> HouseholdService:
    return HouseholdService(db)


@router.get("", response_model=HouseholdRead)
async def get_household(
    actor: Actor = Depends(require_actor),
    svc: HouseholdService = Depends(get_household_service),
) -> HouseholdRead:
    return await svc.get(actor)


@router.patch("", response_model=HouseholdRead)
async def rename_household(
    body: HouseholdUpdate,
    actor: Actor = Depends(require_actor),
    svc: HouseholdService = Depends(get_household_service),
) -> HouseholdRead:
    return await svc.rename(actor, body.name)


@router.post("/join", response_model=HouseholdRead)
async def join_household(
    body: HouseholdJoin,
    actor: Actor = Depends(require_actor),
    svc: HouseholdService = Depends(get_household_service),
) -> HouseholdRead:
    return await svc.join(actor, body.invite_code)


@router.post("/invite-code", response_model=HouseholdRead)
async def rotate_invite_code(
    actor: Actor = Depends(require_actor),
    svc: HouseholdService = Depends(get_household_service),
) -> HouseholdRead:
    return await svc.rotate_invite_code(actor)
