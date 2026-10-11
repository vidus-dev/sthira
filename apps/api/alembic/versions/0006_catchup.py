"""Catch-up and recovery: "Unaccounted" category, password recovery keys, client errors.

- Seeds the new default expense category ``unaccounted`` (used when a balance check finds
  money that went out without an entry) in every household that doesn't have it.
- ``users.recovery_key_hash`` / ``recovery_key_created_at`` for resetting a forgotten
  password with a one-time recovery key.
- ``client_errors``: crashes and errors reported by the phone app.
"""

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_catchup"
down_revision: Union[str, None] = "0005_households"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.add_column("users", sa.Column("recovery_key_hash", sa.String(255), nullable=True))
    op.add_column(
        "users", sa.Column("recovery_key_created_at", sa.DateTime(timezone=True), nullable=True)
    )

    op.create_table(
        "client_errors",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "user_id", UUID, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("message", sa.String(1000), nullable=False),
        sa.Column("stack", sa.Text(), nullable=True),
        sa.Column("fatal", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("app_version", sa.String(64), nullable=True),
        sa.Column("platform", sa.String(64), nullable=True),
        sa.Column("context", postgresql.JSONB(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_client_errors_user_id", "client_errors", ["user_id"])
    op.create_index("ix_client_errors_created_at", "client_errors", ["created_at"])

    bind = op.get_bind()
    missing = bind.execute(
        sa.text(
            "SELECT h.id, COALESCE((SELECT MAX(sort_order) + 1 FROM categories c "
            "WHERE c.household_id = h.id), 0) FROM households h WHERE NOT EXISTS "
            "(SELECT 1 FROM categories c WHERE c.household_id = h.id AND c.slug = 'unaccounted')"
        )
    ).fetchall()
    for household_id, sort in missing:
        bind.execute(
            sa.text(
                "INSERT INTO categories (id, household_id, slug, name, kind, icon, sort_order) "
                "VALUES (:id, :hid, 'unaccounted', 'Unaccounted', 'expense', 'question', :sort)"
            ),
            {"id": uuid.uuid4(), "hid": household_id, "sort": sort},
        )


def downgrade() -> None:
    # The seeded category stays: entries may already use it.
    op.drop_index("ix_client_errors_created_at", table_name="client_errors")
    op.drop_index("ix_client_errors_user_id", table_name="client_errors")
    op.drop_table("client_errors")
    op.drop_column("users", "recovery_key_created_at")
    op.drop_column("users", "recovery_key_hash")
