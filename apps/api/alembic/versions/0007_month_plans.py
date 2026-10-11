"""Month-specific plans.

- ``month_plans`` / ``month_plan_items``: each month's own list, created from the
  repeating items the first time the month is opened.
- ``monthly_payments`` (the repeating items) gain ``kind`` (bill | allowance),
  ``dest_account_id`` (the bucket account money moves to) and ``covers_rest``.
- ``ledger_transactions.plan_item_id`` links a payment to the month's line.

Nothing is backfilled: a month's plan is built (and existing payments linked to it via
``monthly_payment_id`` + ``period_month``) the first time it is opened.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_month_plans"
down_revision: Union[str, None] = "0006_catchup"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = postgresql.UUID(as_uuid=True)


def _account_fk(name: str) -> sa.Column:
    return sa.Column(
        name, UUID, sa.ForeignKey("financial_accounts.id", ondelete="SET NULL"), nullable=True
    )


def upgrade() -> None:
    op.add_column(
        "monthly_payments", sa.Column("kind", sa.String(16), nullable=False, server_default="bill")
    )
    op.add_column("monthly_payments", _account_fk("dest_account_id"))
    op.add_column(
        "monthly_payments",
        sa.Column("covers_rest", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "month_plans",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "household_id", UUID, sa.ForeignKey("households.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("month", sa.Date(), nullable=False),
        sa.Column("salary_override", sa.Numeric(19, 4), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("household_id", "month", name="uq_month_plan_household_month"),
    )
    op.create_index("ix_month_plans_household_id", "month_plans", ["household_id"])

    op.create_table(
        "month_plan_items",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "plan_id", UUID, sa.ForeignKey("month_plans.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "household_id", UUID, sa.ForeignKey("households.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "template_id",
            UUID,
            sa.ForeignKey("monthly_payments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("category_slug", sa.String(64), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False, server_default="bill"),
        sa.Column("amount_type", sa.String(16), nullable=False, server_default="fixed"),
        sa.Column("amount", sa.Numeric(19, 4), nullable=True),
        sa.Column("percent", sa.Numeric(7, 4), nullable=True),
        sa.Column("covers_rest", sa.Boolean(), nullable=False, server_default=sa.false()),
        _account_fk("dest_account_id"),
        _account_fk("default_account_id"),
        sa.Column("due_day", sa.SmallInteger(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("closed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("carried_over", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "carried_from_id",
            UUID,
            sa.ForeignKey("month_plan_items.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_month_plan_items_plan_id", "month_plan_items", ["plan_id"])
    op.create_index("ix_month_plan_items_household_id", "month_plan_items", ["household_id"])
    op.create_index("ix_month_plan_items_template_id", "month_plan_items", ["template_id"])

    op.add_column(
        "ledger_transactions",
        sa.Column(
            "plan_item_id",
            UUID,
            sa.ForeignKey("month_plan_items.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_ledger_transactions_plan_item_id", "ledger_transactions", ["plan_item_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_ledger_transactions_plan_item_id", table_name="ledger_transactions")
    op.drop_column("ledger_transactions", "plan_item_id")
    op.drop_table("month_plan_items")
    op.drop_table("month_plans")
    op.drop_column("monthly_payments", "covers_rest")
    op.drop_column("monthly_payments", "dest_account_id")
    op.drop_column("monthly_payments", "kind")
