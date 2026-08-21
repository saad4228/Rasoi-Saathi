from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Branch(Base):
    __tablename__ = "branches"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    restaurant_id: Mapped[UUID] = mapped_column(ForeignKey("restaurants.id"), index=True, nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    supports_dine_in: Mapped[bool] = mapped_column(Boolean, nullable=False)
    supports_takeaway: Mapped[bool] = mapped_column(Boolean, nullable=False)
    supports_delivery: Mapped[bool] = mapped_column(Boolean, nullable=False)

    restaurant: Mapped["Restaurant"] = relationship(back_populates="branches")
    inventory_items: Mapped[list["InventoryItem"]] = relationship(back_populates="branch")
    orders: Mapped[list["Order"]] = relationship(back_populates="branch")
    inventory_transactions: Mapped[list["InventoryTransaction"]] = relationship(back_populates="branch")
    demand_forecasts: Mapped[list["DemandForecast"]] = relationship(back_populates="branch")
    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(back_populates="branch")