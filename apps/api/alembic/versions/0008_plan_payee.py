"""Who a plan item is paid to over UPI.

``payee_upi`` (a UPI ID such as ``name@okicici``) and ``payee_name`` on the repeating
items and on each month's lines, so "Pay" can open the person's UPI app with the payee,
amount and note filled in.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_plan_payee"
down_revision: Union[str, None] = "0007_month_plans"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ("monthly_payments", "month_plan_items")


def upgrade() -> None:
    for table in TABLES:
        op.add_column(table, sa.Column("payee_upi", sa.String(100), nullable=True))
        op.add_column(table, sa.Column("payee_name", sa.String(80), nullable=True))


def downgrade() -> None:
    for table in TABLES:
        op.drop_column(table, "payee_name")
        op.drop_column(table, "payee_upi")
