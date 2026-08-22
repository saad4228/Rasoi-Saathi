"""add image URL to menu items

Revision ID: a3c7e2d91f4b
Revises: ef796ca0f63c
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a3c7e2d91f4b"
down_revision: Union[str, Sequence[str], None] = "ef796ca0f63c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("menu_items", sa.Column("image_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("menu_items", "image_url")