import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
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
    household_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("households.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    display_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    # bcrypt hash of a one-time recovery key; lets the owner reset a forgotten password
    # without an email service. Cleared once used.
    recovery_key_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recovery_key_created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    household = relationship("Household", back_populates="members")
    financial_goals = relationship(
        "FinancialGoal", back_populates="user", cascade="all, delete-orphan"
    )
    financial_accounts = relationship(
        "FinancialAccount",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="FinancialAccount.user_id",
    )
    ledger_transactions = relationship(
        "LedgerTransaction", back_populates="user", cascade="all, delete-orphan"
    )
    budget_lines = relationship(
        "BudgetLine", back_populates="user", cascade="all, delete-orphan"
    )
