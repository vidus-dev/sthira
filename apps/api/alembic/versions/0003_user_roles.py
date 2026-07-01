"""Add role column to users for RBAC."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_user_roles"
down_revision: Union[str, None] = "0002_hardening"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "role",
            sa.String(length=32),
            nullable=False,
            server_default="user",
        ),
    )
    op.create_index("ix_users_role", "users", ["role"])


def downgrade() -> None:
    op.drop_index("ix_users_role", table_name="users")
    op.drop_column("users", "role")
