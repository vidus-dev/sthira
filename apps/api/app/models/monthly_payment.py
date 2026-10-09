import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MonthlyPayment(Base):
    """A compulsory monthly payment (rent, EMI, 10% of salary to guru, ...).

    ``amount_type`` decides what is due each month:
    - ``fixed``: ``amount``
    - ``percent``: ``percent`` of the income recorded that month in ``base_category_slug``
    - ``variable``: entered when paid; ``amount`` is an optional estimate

    Payments are ordinary transactions linked via ``monthly_payment_id`` + ``period_month``.
    """

    __tablename__ = "monthly_payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    household_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    category_slug: Mapped[str] = mapped_column(String(64), nullable=False)
    amount_type: Mapped[str] = mapped_column(String(16), nullable=False, default="fixed")
    amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 4), nullable=True)
    percent: Mapped[Decimal | None] = mapped_column(Numeric(7, 4), nullable=True)
    base_category_slug: Mapped[str | None] = mapped_column(String(64), nullable=True)
    default_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("financial_accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    due_day: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
