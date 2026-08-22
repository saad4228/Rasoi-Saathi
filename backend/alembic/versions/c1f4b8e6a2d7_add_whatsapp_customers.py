"""add WhatsApp customers and order customer link

Revision ID: c1f4b8e6a2d7
Revises: a3c7e2d91f4b
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1f4b8e6a2d7"
down_revision: Union[str, Sequence[str], None] = "a3c7e2d91f4b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "customers",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("restaurant_id", sa.UUID(), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=True),
        sa.Column("preferred_language", sa.String(length=10), server_default="en", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("restaurant_id", "phone", name="unique_customer_per_restaurant"),
    )
    op.create_index(op.f("ix_customers_restaurant_id"), "customers", ["restaurant_id"], unique=False)
    op.add_column("orders", sa.Column("customer_id", sa.UUID(), nullable=True))
    op.create_foreign_key("fk_orders_customer_id_customers", "orders", "customers", ["customer_id"], ["id"])
    op.create_index(op.f("ix_orders_customer_id"), "orders", ["customer_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_orders_customer_id"), table_name="orders")
    op.drop_constraint("fk_orders_customer_id_customers", "orders", type_="foreignkey")
    op.drop_column("orders", "customer_id")
    op.drop_index(op.f("ix_customers_restaurant_id"), table_name="customers")
    op.drop_table("customers")