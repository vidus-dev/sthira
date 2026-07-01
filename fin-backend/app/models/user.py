import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default="user", default="user", index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    financial_goals = relationship(
        "FinancialGoal", back_populates="user", cascade="all, delete-orphan"
    )
    financial_accounts = relationship(
        "FinancialAccount", back_populates="user", cascade="all, delete-orphan"
    )
    ledger_transactions = relationship(
        "LedgerTransaction", back_populates="user", cascade="all, delete-orphan"
    )
    budget_lines = relationship(
        "BudgetLine", back_populates="user", cascade="all, delete-orphan"
    )
