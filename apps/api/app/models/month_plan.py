import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MonthPlan(Base):
    """One month's plan (e.g. October 2026): its own list of items, made from the
    repeating items (``monthly_payments``) the first time the month is opened.
    """

    __tablename__ = "month_plans"
    __table_args__ = (
        UniqueConstraint("household_id", "month", name="uq_month_plan_household_month"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    household_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    month: Mapped[date] = mapped_column(Date, nullable=False)  # first day of the month
    # Salary the % items use; NULL = worked out from salary entries.
    salary_override: Mapped[Decimal | None] = mapped_column(Numeric(19, 4), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class MonthPlanItem(Base):
    """A line in one month's plan.

    ``kind``: a ``bill`` is paid (rent, EMI); an ``allowance`` is money set aside and spent
    through the month (groceries). ``dest_account_id`` is the account the money moves to
    (a "bucket"). ``template_id`` is the repeating item it came from; NULL means "only this
    month".
    """

    __tablename__ = "month_plan_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("month_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    household_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("monthly_payments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    category_slug: Mapped[str] = mapped_column(String(64), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False, default="bill")
    amount_type: Mapped[str] = mapped_column(String(16), nullable=False, default="fixed")
    amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 4), nullable=True)
    percent: Mapped[Decimal | None] = mapped_column(Numeric(7, 4), nullable=True)
    # An allowance that counts all spending not covered by another item ("Misc").
    covers_rest: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    dest_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("financial_accounts.id", ondelete="SET NULL"), nullable=True
    )
    default_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("financial_accounts.id", ondelete="SET NULL"), nullable=True
    )
    due_day: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Marked done by hand (e.g. settled outside the app).
    closed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Left unpaid and moved into the next month.
    carried_over: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    carried_from_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("month_plan_items.id", ondelete="SET NULL"), nullable=True
    )
    # Paid to over UPI ("name@okicici"), so Pay can open the UPI app with it filled in.
    payee_upi: Mapped[str | None] = mapped_column(String(100), nullable=True)
    payee_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
