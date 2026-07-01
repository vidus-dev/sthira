"""Link the two ledger legs of a transfer via transfer_id."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_transfers"
down_revision: Union[str, None] = "0003_user_roles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ledger_transactions",
        sa.Column("transfer_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_ledger_transactions_transfer_id", "ledger_transactions", ["transfer_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_ledger_transactions_transfer_id", table_name="ledger_transactions")
    op.drop_column("ledger_transactions", "transfer_id")
