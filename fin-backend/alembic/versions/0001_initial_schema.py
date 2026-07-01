"""Initial schema: users, goals, accounts, transactions, budgets."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "financial_goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("goal_kind", sa.String(32), nullable=False, server_default="custom"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("target_amount", sa.Numeric(19, 4), nullable=False),
        sa.Column("saved_amount", sa.Numeric(19, 4), nullable=False, server_default="0"),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_financial_goals_user_id", "financial_goals", ["user_id"])

    op.create_table(
        "financial_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("institution", sa.String(255), nullable=True),
        sa.Column("account_type", sa.String(32), nullable=False, server_default="checking"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("balance", sa.Numeric(19, 4), nullable=False, server_default="0"),
        sa.Column("mask_last4", sa.String(4), nullable=True),
        sa.Column("color_token", sa.String(64), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_financial_accounts_user_id", "financial_accounts", ["user_id"])

    op.create_table(
        "ledger_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(19, 4), nullable=False),
        sa.Column("description", sa.String(512), nullable=False, server_default=""),
        sa.Column("category_slug", sa.String(64), nullable=False, server_default="uncategorized"),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["account_id"], ["financial_accounts.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_ledger_transactions_user_id", "ledger_transactions", ["user_id"])
    op.create_index("ix_ledger_transactions_account_id", "ledger_transactions", ["account_id"])
    op.create_index("ix_ledger_transactions_occurred_at", "ledger_transactions", ["occurred_at"])

    op.create_table(
        "budget_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_slug", sa.String(64), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("limit_amount", sa.Numeric(19, 4), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "category_slug", "year", "month", name="uq_budget_user_cat_period"),
    )
    op.create_index("ix_budget_lines_user_id", "budget_lines", ["user_id"])


def downgrade() -> None:
    op.drop_table("budget_lines")
    op.drop_table("ledger_transactions")
    op.drop_table("financial_accounts")
    op.drop_table("financial_goals")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
