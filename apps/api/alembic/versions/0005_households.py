"""Households (shared data), categories, monthly plan, transaction source + plan links.

Every existing user gets their own household; every row is backfilled with its
creator's household so nothing changes for existing data. Default categories (plus
any slugs already in use) are seeded per household.
"""

import secrets
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_households"
down_revision: Union[str, None] = "0004_transfers"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = postgresql.UUID(as_uuid=True)

# Frozen copy of app.modules.households.defaults.DEFAULT_CATEGORIES at this revision.
_DEFAULT_CATEGORIES = (
    ("food-delivery", "Food delivery", "expense", "bowl"),
    ("groceries", "Groceries", "expense", "basket"),
    ("vegetables", "Vegetables", "expense", "leaf"),
    ("non-veg", "Non-veg", "expense", "fish"),
    ("milk", "Milk", "expense", "milk"),
    ("dining-out", "Dining out", "expense", "utensils"),
    ("rent", "Rent", "expense", "home"),
    ("maintenance", "Maintenance", "expense", "wrench"),
    ("electricity", "Electricity", "expense", "bolt"),
    ("internet", "Internet", "expense", "wifi"),
    ("mobile", "Mobile recharge", "expense", "phone"),
    ("loan-emi", "Loan EMI", "expense", "bank"),
    ("guru-dakshina", "Guru dakshina", "expense", "sparkle"),
    ("donations", "Donations", "expense", "heart"),
    ("fuel", "Fuel", "expense", "fuel"),
    ("transport", "Transport", "expense", "car"),
    ("shopping", "Shopping", "expense", "bag"),
    ("medical", "Medical", "expense", "medical"),
    ("entertainment", "Entertainment", "expense", "film"),
    ("personal-care", "Personal care", "expense", "scissors"),
    ("gifts", "Gifts", "expense", "gift"),
    ("household", "Household items", "expense", "sofa"),
    ("education", "Education", "expense", "book"),
    ("other", "Other", "expense", "dots"),
    ("salary", "Salary", "income", "salary"),
    ("other-income", "Other income", "income", "coins"),
    ("interest-refunds", "Interest & refunds", "income", "percent"),
)
_RESERVED_SLUGS = {"transfer", "uncategorized"}
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_SCOPED_TABLES = ("financial_accounts", "ledger_transactions", "budget_lines", "financial_goals")


def _invite_code() -> str:
    chars = "".join(secrets.choice(_ALPHABET) for _ in range(8))
    return f"{chars[:4]}-{chars[4:]}"


def upgrade() -> None:
    op.create_table(
        "households",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("invite_code", sa.String(16), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="Asia/Kolkata"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.UniqueConstraint("invite_code", name="uq_households_invite_code"),
    )

    # --- users -> households -------------------------------------------------------
    op.add_column("users", sa.Column("household_id", UUID, nullable=True))
    op.add_column("users", sa.Column("display_name", sa.String(80), nullable=True))

    bind = op.get_bind()
    for (user_id,) in bind.execute(sa.text("SELECT id FROM users")).fetchall():
        household_id = uuid.uuid4()
        bind.execute(
            sa.text(
                "INSERT INTO households (id, name, invite_code) VALUES (:id, 'Our home', :code)"
            ),
            {"id": household_id, "code": _invite_code()},
        )
        bind.execute(
            sa.text("UPDATE users SET household_id = :hid WHERE id = :uid"),
            {"hid": household_id, "uid": user_id},
        )
    op.alter_column("users", "household_id", nullable=False)
    op.create_foreign_key(None, "users", "households", ["household_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_users_household_id", "users", ["household_id"])

    # --- scope every data table by household ----------------------------------------
    for table in _SCOPED_TABLES:
        op.add_column(table, sa.Column("household_id", UUID, nullable=True))
        op.execute(
            f"UPDATE {table} AS t SET household_id = u.household_id "
            f"FROM users AS u WHERE u.id = t.user_id"
        )
        op.alter_column(table, "household_id", nullable=False)
        op.create_foreign_key(None, table, "households", ["household_id"], ["id"], ondelete="CASCADE")
        op.create_index(f"ix_{table}_household_id", table, ["household_id"])

    op.add_column("financial_accounts", sa.Column("owner_user_id", UUID, nullable=True))
    op.create_foreign_key(
        None, "financial_accounts", "users", ["owner_user_id"], ["id"], ondelete="SET NULL"
    )

    op.drop_constraint("uq_budget_user_cat_period", "budget_lines", type_="unique")
    op.create_unique_constraint(
        "uq_budget_household_cat_period",
        "budget_lines",
        ["household_id", "category_slug", "year", "month"],
    )

    # --- categories -------------------------------------------------------------------
    op.create_table(
        "categories",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("household_id", UUID, nullable=False),
        sa.Column("slug", sa.String(64), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False, server_default="expense"),
        sa.Column("icon", sa.String(48), nullable=False, server_default="dots"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("household_id", "slug", name="uq_category_household_slug"),
    )
    op.create_index("ix_categories_household_id", "categories", ["household_id"])

    insert_category = sa.text(
        "INSERT INTO categories (id, household_id, slug, name, kind, icon, sort_order) "
        "VALUES (:id, :hid, :slug, :name, :kind, :icon, :sort)"
    )
    default_slugs = {slug for slug, *_ in _DEFAULT_CATEGORIES}
    for (household_id,) in bind.execute(sa.text("SELECT id FROM households")).fetchall():
        for sort, (slug, name, kind, icon) in enumerate(_DEFAULT_CATEGORIES):
            bind.execute(
                insert_category,
                {"id": uuid.uuid4(), "hid": household_id, "slug": slug, "name": name,
                 "kind": kind, "icon": icon, "sort": sort},
            )
        used = bind.execute(
            sa.text(
                "SELECT DISTINCT category_slug FROM ledger_transactions WHERE household_id = :hid "
                "UNION SELECT DISTINCT category_slug FROM budget_lines WHERE household_id = :hid"
            ),
            {"hid": household_id},
        ).fetchall()
        extra = sorted({slug for (slug,) in used} - default_slugs - _RESERVED_SLUGS)
        for offset, slug in enumerate(extra):
            bind.execute(
                insert_category,
                {"id": uuid.uuid4(), "hid": household_id, "slug": slug,
                 "name": slug.replace("-", " ").replace("_", " ").title()[:80],
                 "kind": "expense", "icon": "dots", "sort": len(_DEFAULT_CATEGORIES) + offset},
            )

    # --- monthly plan -----------------------------------------------------------------
    op.create_table(
        "monthly_payments",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("household_id", UUID, nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("category_slug", sa.String(64), nullable=False),
        sa.Column("amount_type", sa.String(16), nullable=False, server_default="fixed"),
        sa.Column("amount", sa.Numeric(19, 4), nullable=True),
        sa.Column("percent", sa.Numeric(7, 4), nullable=True),
        sa.Column("base_category_slug", sa.String(64), nullable=True),
        sa.Column("default_account_id", UUID, nullable=True),
        sa.Column("due_day", sa.SmallInteger(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", UUID, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["default_account_id"], ["financial_accounts.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_monthly_payments_household_id", "monthly_payments", ["household_id"])

    # --- transactions: capture source + plan links -------------------------------------
    op.add_column(
        "ledger_transactions",
        sa.Column("source", sa.String(16), nullable=False, server_default="manual"),
    )
    op.add_column("ledger_transactions", sa.Column("source_ref", sa.String(128), nullable=True))
    op.add_column("ledger_transactions", sa.Column("monthly_payment_id", UUID, nullable=True))
    op.add_column("ledger_transactions", sa.Column("period_month", sa.Date(), nullable=True))
    op.create_foreign_key(
        None,
        "ledger_transactions",
        "monthly_payments",
        ["monthly_payment_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_ledger_transactions_monthly_payment_id", "ledger_transactions", ["monthly_payment_id"]
    )
    op.create_index(
        "uq_ledger_tx_household_source_ref",
        "ledger_transactions",
        ["household_id", "source_ref"],
        unique=True,
        postgresql_where=sa.text("source_ref IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_ledger_tx_household_source_ref", table_name="ledger_transactions")
    op.drop_index("ix_ledger_transactions_monthly_payment_id", table_name="ledger_transactions")
    for column in ("period_month", "monthly_payment_id", "source_ref", "source"):
        op.drop_column("ledger_transactions", column)

    op.drop_index("ix_monthly_payments_household_id", table_name="monthly_payments")
    op.drop_table("monthly_payments")
    op.drop_index("ix_categories_household_id", table_name="categories")
    op.drop_table("categories")

    op.drop_constraint("uq_budget_household_cat_period", "budget_lines", type_="unique")
    op.create_unique_constraint(
        "uq_budget_user_cat_period", "budget_lines", ["user_id", "category_slug", "year", "month"]
    )

    op.drop_column("financial_accounts", "owner_user_id")
    for table in _SCOPED_TABLES:
        op.drop_index(f"ix_{table}_household_id", table_name=table)
        op.drop_column(table, "household_id")

    op.drop_index("ix_users_household_id", table_name="users")
    op.drop_column("users", "display_name")
    op.drop_column("users", "household_id")
    op.drop_table("households")
