from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DemandForecast(Base):
    __tablename__ = "demand_forecasts"
    __table_args__ = (
        UniqueConstraint("branch_id", "menu_item_id", "forecast_date", name="uq_demand_forecasts_branch_item_date"),
        CheckConstraint("predicted_quantity >= 0", name="ck_demand_forecasts_quantity_nonnegative"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID] = mapped_column(ForeignKey("branches.id"), index=True, nullable=False)
    menu_item_id: Mapped[UUID] = mapped_column(ForeignKey("menu_items.id"), index=True, nullable=False)
    forecast_date: Mapped[date] = mapped_column(Date, nullable=False)
    predicted_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    branch: Mapped["Branch"] = relationship(back_populates="demand_forecasts")
    menu_item: Mapped["MenuItem"] = relationship(back_populates="demand_forecasts")