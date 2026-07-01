"""Goal use-cases — orchestrates repository + calculator."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import FinancialGoal
from app.modules.goals import calculator
from app.modules.goals.repository import GoalRepository
from app.modules.goals.schemas import FinancialGoalCreate, FinancialGoalRead, FinancialGoalUpdate


class GoalService:
    def __init__(self, session: AsyncSession) -> None:
        self._repo = GoalRepository(session)
        self._session = session

    def _to_read(self, g: FinancialGoal) -> FinancialGoalRead:
        suggested = calculator.suggested_monthly_contribution(
            g.target_amount,
            g.saved_amount,
            g.target_date,
        )
        prog = calculator.progress_ratio(g.target_amount, g.saved_amount)
        return FinancialGoalRead(
            id=g.id,
            user_id=g.user_id,
            name=g.name,
            goal_kind=g.goal_kind,
            currency=g.currency,
            target_amount=g.target_amount,
            saved_amount=g.saved_amount,
            target_date=g.target_date,
            notes=g.notes,
            suggested_monthly_contribution=suggested,
            progress=prog,
            created_at=g.created_at,
            updated_at=g.updated_at,
        )

    async def list_goals(self, user_id: UUID) -> list[FinancialGoalRead]:
        rows = await self._repo.list_for_user(user_id)
        return [self._to_read(r) for r in rows]

    async def get_goal(self, user_id: UUID, goal_id: UUID) -> FinancialGoalRead | None:
        g = await self._repo.get_for_user(user_id, goal_id)
        return self._to_read(g) if g else None

    async def create_goal(self, user_id: UUID, body: FinancialGoalCreate) -> FinancialGoalRead:
        if body.saved_amount > body.target_amount:
            raise ValueError("saved_amount cannot exceed target_amount")
        goal = FinancialGoal(
            user_id=user_id,
            name=body.name,
            goal_kind=body.goal_kind,
            currency=body.currency,
            target_amount=body.target_amount,
            saved_amount=body.saved_amount,
            target_date=body.target_date,
            notes=body.notes,
        )
        await self._repo.add(goal)
        await self._session.commit()
        await self._session.refresh(goal)
        return self._to_read(goal)

    async def update_goal(
        self, user_id: UUID, goal_id: UUID, body: FinancialGoalUpdate
    ) -> FinancialGoalRead | None:
        g = await self._repo.get_for_user(user_id, goal_id)
        if g is None:
            return None
        data = body.model_dump(exclude_unset=True)
        for key, val in data.items():
            setattr(g, key, val)
        if g.saved_amount > g.target_amount:
            await self._session.rollback()
            raise ValueError("saved_amount cannot exceed target_amount")
        g.updated_at = datetime.now(UTC)
        await self._session.commit()
        await self._session.refresh(g)
        return self._to_read(g)

    async def delete_goal(self, user_id: UUID, goal_id: UUID) -> bool:
        g = await self._repo.get_for_user(user_id, goal_id)
        if g is None:
            return False
        await self._repo.delete(g)
        await self._session.commit()
        return True
