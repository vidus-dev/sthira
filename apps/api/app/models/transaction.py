import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Index, Numeric, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class LedgerTransaction(Base):
    """Signed amount: positive = inflow, negative = outflow."""

    __tablename__ = "ledger_transactions"
    __table_args__ = (
        Index(
            "uq_ledger_tx_household_source_ref",
            "household_id",
            "source_ref",
            unique=True,
            postgresql_where=text("source_ref IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )  # who added it
    household_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("financial_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(19, 4), nullable=False)
    description: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    category_slug: Mapped[str] = mapped_column(String(64), nullable=False, default="uncategorized")
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    transfer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    # How it was captured: manual | sms | ai. ``source_ref`` dedupes imports (e.g. an SMS hash).
    source: Mapped[str] = mapped_column(
        String(16), nullable=False, default="manual", server_default="manual"
    )
    source_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Set when this transaction pays a monthly plan item; ``period_month`` is the 1st of
    # the month it counts towards (rent for October may be paid on 2 November).
    monthly_payment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("monthly_payments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    period_month: Mapped[date | None] = mapped_column(Date, nullable=True)

    user = relationship("User", back_populates="ledger_transactions")
    account = relationship("FinancialAccount", back_populates="transactions")
