from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BranchResponse(BaseModel):
    id: UUID
    restaurant_name: str | None = None
    address: str | None
    phone: str | None
    is_active: bool
    supports_dine_in: bool
    supports_takeaway: bool
    supports_delivery: bool
    model_config = ConfigDict(from_attributes=True)


class BranchCreate(BaseModel):
    address: str = Field(min_length=1)
    phone: str | None = None
    supports_dine_in: bool = True
    supports_takeaway: bool = True
    supports_delivery: bool = True


class CustomerCreate(BaseModel):
    phone: str = Field(min_length=1, max_length=20)
    name: str | None = Field(default=None, max_length=150)
    preferred_language: str = Field(default="en", pattern="^(en|hi)$")


class CustomerResponse(BaseModel):
    id: UUID
    restaurant_id: UUID
    phone: str
    name: str | None
    preferred_language: str
    model_config = ConfigDict(from_attributes=True)


class MenuItemIngredientCreate(BaseModel):
    inventory_item_name: str = Field(min_length=1, max_length=150)
    unit: str = Field(min_length=1, max_length=20)
    current_stock: Decimal = Field(default=0, ge=0)
    safety_stock_level: Decimal = Field(default=0, ge=0)
    reorder_delay_days: int = Field(default=0, ge=0)
    cost_per_unit: Decimal = Field(default=0, ge=0)
    shelf_life_days: int | None = Field(default=None, ge=0)
    quantity_per_unit: Decimal = Field(gt=0)


class MenuItemResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    category: str | None
    food_type: str
    image_url: str | None
    price: Decimal
    is_active: bool
    low_stock_ingredient_count: int = 0
    ingredients: list[dict] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class MenuItemCreate(BaseModel):
    branch_id: UUID
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    category: str | None = None
    food_type: str = Field(default="veg", pattern="^(veg|non-veg)$")
    image_url: str | None = None
    price: Decimal = Field(ge=0)
    is_active: bool = True
    ingredients: list[MenuItemIngredientCreate] = Field(default_factory=list)


class MenuItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    category: str | None = None
    food_type: str | None = Field(default=None, pattern="^(veg|non-veg)$")
    image_url: str | None = None
    price: Decimal | None = Field(default=None, ge=0)
    is_active: bool | None = None


class InventoryItemResponse(BaseModel):
    id: UUID
    branch_id: UUID
    name: str
    unit: str
    current_stock: Decimal
    safety_stock_level: Decimal
    reorder_delay_days: int
    cost_per_unit: Decimal
    shelf_life_days: int | None
    status: str
    days_until_empty: float | None


class InventoryItemCreate(BaseModel):
    branch_id: UUID
    name: str = Field(min_length=1, max_length=150)
    unit: str = Field(min_length=1, max_length=20)
    current_stock: Decimal = Field(default=0, ge=0)
    safety_stock_level: Decimal = Field(default=0, ge=0)
    reorder_delay_days: int = Field(default=0, ge=0)
    cost_per_unit: Decimal = Field(ge=0)
    shelf_life_days: int | None = Field(default=None, ge=0)


class InventoryItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    current_stock: Decimal | None = Field(default=None, ge=0)
    safety_stock_level: Decimal | None = Field(default=None, ge=0)
    reorder_delay_days: int | None = Field(default=None, ge=0)
    cost_per_unit: Decimal | None = Field(default=None, ge=0)
    shelf_life_days: int | None = Field(default=None, ge=0)


class OrderItemResponse(BaseModel):
    id: UUID
    menu_item_id: UUID
    menu_item_name: str
    quantity: int
    unit_price: Decimal
    total_price: Decimal


class OrderItemCreate(BaseModel):
    menu_item_id: UUID
    quantity: int = Field(gt=0)


class OrderCreate(BaseModel):
    branch_id: UUID
    order_type: str = Field(default="DINE_IN", min_length=1, max_length=30)
    customer_id: UUID | None = None
    items: list[OrderItemCreate] = Field(min_length=1)


class OrderResponse(BaseModel):
    id: UUID
    branch_id: UUID
    customer_id: UUID | None
    order_source: str
    order_type: str
    status: str
    total_amount: Decimal
    ordered_at: datetime
    items: list[OrderItemResponse]


class OrderStatusUpdate(BaseModel):
    status: str = Field(min_length=1, max_length=30)


class ForecastResponse(BaseModel):
    id: UUID
    branch_id: UUID
    menu_item_id: UUID
    forecast_date: date
    predicted_quantity: Decimal
    model_config = ConfigDict(from_attributes=True)


class SubscriptionResponse(BaseModel):
    id: UUID
    module_id: UUID
    status: str
    start_date: datetime
    end_date: datetime | None
    model_config = ConfigDict(from_attributes=True)


class StaffMemberResponse(BaseModel):
    id: UUID
    restaurant_id: UUID
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class StaffMemberCreate(BaseModel):
    user_id: UUID | None = None
    name: str = Field(min_length=1, max_length=150)
    email: str = Field(min_length=3, max_length=255)
    role: str = Field(pattern="^(owner|chef|waiter)$")


class StaffMemberUpdate(BaseModel):
    name: str | None = None
    role: str | None = Field(default=None, pattern="^(owner|chef|waiter)$")
    is_active: bool | None = None