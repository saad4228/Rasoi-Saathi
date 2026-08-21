from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class InventoryItem(Base):
    __tablename__ = "inventory_items"
    __table_args__ = (
        CheckConstraint("current_stock >= 0", name="ck_inventory_items_current_stock_nonnegative"),
        CheckConstraint("safety_stock_level >= 0", name="ck_inventory_items_safety_stock_nonnegative"),
        CheckConstraint("reorder_delay_days >= 0", name="ck_inventory_items_reorder_delay_nonnegative"),
        CheckConstraint("cost_per_unit >= 0", name="ck_inventory_items_cost_nonnegative"),
        CheckConstraint("shelf_life_days IS NULL OR shelf_life_days >= 0", name="ck_inventory_items_shelf_life_nonnegative"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID] = mapped_column(ForeignKey("branches.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    current_stock: Mapped[Decimal] = mapped_column(Numeric(12, 3), server_default="0", nullable=False)
    safety_stock_level: Mapped[Decimal] = mapped_column(Numeric(12, 3), server_default="0", nullable=False)
    reorder_delay_days: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    cost_per_unit: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    shelf_life_days: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    branch: Mapped["Branch"] = relationship(back_populates="inventory_items")
    ingredients: Mapped[list["MenuItemIngredient"]] = relationship(back_populates="inventory_item")
    transactions: Mapped[list["InventoryTransaction"]] = relationship(back_populates="inventory_item")
    purchase_order_items: Mapped[list["PurchaseOrderItem"]] = relationship(back_populates="inventory_item")