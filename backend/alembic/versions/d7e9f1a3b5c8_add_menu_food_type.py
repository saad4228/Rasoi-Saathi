"""add menu food type

Revision ID: d7e9f1a3b5c8
Revises: c1f4b8e6a2d7
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d7e9f1a3b5c8"
down_revision: Union[str, Sequence[str], None] = "c1f4b8e6a2d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("menu_items", sa.Column("food_type", sa.String(length=10), server_default="veg", nullable=False))


def downgrade() -> None:
    op.drop_column("menu_items", "food_type")