"""Account use-cases."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.actor import Actor
from app.models.account import FinancialAccount
from app.modules.accounts.repository import AccountRepository
from app.modules.accounts.schemas import AccountCreate, AccountRead, AccountUpdate
from app.modules.households.service import member_ids


class AccountService:
    def __init__(self, session: AsyncSession) -> None:
        self._repo = AccountRepository(session)
        self._session = session

    def _to_read(self, a: FinancialAccount) -> AccountRead:
        return AccountRead.model_validate(a)

    async def _check_owner(self, actor: Actor, owner_user_id: UUID | None) -> None:
        if owner_user_id is not None and owner_user_id not in await member_ids(
            self._session, actor.household_id
        ):
            raise ValueError("Account owner must be a member of your household")

    async def list_accounts(self, actor: Actor) -> list[AccountRead]:
        rows = await self._repo.list_for_household(actor.household_id)
        return [self._to_read(x) for x in rows]

    async def get(self, actor: Actor, account_id: UUID) -> AccountRead | None:
        row = await self._repo.get(actor.household_id, account_id)
        return self._to_read(row) if row else None

    async def create(self, actor: Actor, body: AccountCreate) -> AccountRead:
        await self._check_owner(actor, body.owner_user_id)
        if body.is_default:
            await self._repo.clear_default_flag(actor.household_id, None)
        row = FinancialAccount(
            user_id=actor.user_id,
            household_id=actor.household_id,
            owner_user_id=body.owner_user_id,
            display_name=body.display_name,
            institution=body.institution,
            account_type=body.account_type,
            currency=body.currency,
            balance=body.balance,
            mask_last4=body.mask_last4,
            color_token=body.color_token,
            is_default=body.is_default,
        )
        await self._repo.add(row)
        await self._session.commit()
        await self._session.refresh(row)
        return self._to_read(row)

    async def update(
        self, actor: Actor, account_id: UUID, body: AccountUpdate
    ) -> AccountRead | None:
        row = await self._repo.get(actor.household_id, account_id)
        if row is None:
            return None
        data = body.model_dump(exclude_unset=True)
        if "owner_user_id" in data:
            await self._check_owner(actor, data["owner_user_id"])
        if data.get("is_default") is True:
            await self._repo.clear_default_flag(actor.household_id, except_id=account_id)
        for k, v in data.items():
            setattr(row, k, v)
        row.updated_at = datetime.now(UTC)
        await self._session.commit()
        await self._session.refresh(row)
        return self._to_read(row)

    async def delete(self, actor: Actor, account_id: UUID) -> bool:
        row = await self._repo.get(actor.household_id, account_id)
        if row is None:
            return False
        await self._repo.delete(row)
        await self._session.commit()
        return True
