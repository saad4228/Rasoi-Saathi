from __future__ import annotations

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MenuItemIngredient(Base):
    __tablename__ = "menu_item_ingredients"
    __table_args__ = (
        UniqueConstraint("menu_item_id", "inventory_item_id", name="uq_menu_item_ingredients_item_inventory"),
        CheckConstraint("quantity_per_unit > 0", name="ck_menu_item_ingredients_quantity_positive"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    menu_item_id: Mapped[UUID] = mapped_column(ForeignKey("menu_items.id"), index=True, nullable=False)
    inventory_item_id: Mapped[UUID] = mapped_column(ForeignKey("inventory_items.id"), index=True, nullable=False)
    quantity_per_unit: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)

    menu_item: Mapped["MenuItem"] = relationship(back_populates="ingredients")
    inventory_item: Mapped["InventoryItem"] = relationship(back_populates="ingredients")