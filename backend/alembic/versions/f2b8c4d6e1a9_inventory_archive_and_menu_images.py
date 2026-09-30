"""archive inventory items; set up the menu-images storage bucket

Revision ID: f2b8c4d6e1a9
Revises: d7e9f1a3b5c8

Inventory items with stock history are now archived (is_active = false)
instead of deleted.

On Supabase, this migration also creates the public `menu-images` bucket and
its upload policies (previously a manual step: supabase/menu-images.sql). On
any other Postgres, or if the role lacks permission, that part is skipped.
"""
import logging
from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import context, op

revision: str = "f2b8c4d6e1a9"
down_revision: Union[str, Sequence[str], None] = "d7e9f1a3b5c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

logger = logging.getLogger("alembic.runtime.migration")
STORAGE_SQL = Path(__file__).resolve().parents[3] / "supabase" / "menu-images.sql"


def _setup_menu_image_bucket() -> None:
    if context.is_offline_mode():
        logger.info("Offline mode: run supabase/menu-images.sql separately to set up the menu-images bucket")
        return
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    if bind.execute(sa.text("select to_regclass('storage.buckets')")).scalar() is None:
        return  # not a Supabase database
    if not STORAGE_SQL.exists():
        logger.warning("Skipping menu-images bucket setup: %s not found", STORAGE_SQL)
        return
    script = "\n".join(line for line in STORAGE_SQL.read_text(encoding="utf-8").splitlines() if not line.strip().startswith("--"))
    statements = [statement.strip() for statement in script.split(";") if statement.strip()]
    savepoint = bind.begin_nested()
    try:
        for statement in statements:
            bind.exec_driver_sql(statement)
        savepoint.commit()
        logger.info("Configured the Supabase 'menu-images' storage bucket")
    except Exception as exc:  # noqa: BLE001 - optional setup must not block the schema change
        savepoint.rollback()
        logger.warning("Could not configure the 'menu-images' bucket automatically (%s). Run supabase/menu-images.sql in the Supabase SQL editor.", exc)


def upgrade() -> None:
    op.add_column("inventory_items", sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False))
    _setup_menu_image_bucket()


def downgrade() -> None:
    op.drop_column("inventory_items", "is_active")
