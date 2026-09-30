from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

OrderStatus = Literal["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"]
OrderType = Literal["DINE_IN", "TAKEAWAY", "DELIVERY"]
StaffRole = Literal["owner", "chef", "waiter"]


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
    address: str = Field(min_length=1, max_length=500)
    phone: str | None = Field(default=None, max_length=20)
    is_active: bool = True
    supports_dine_in: bool = True
    supports_takeaway: bool = True
    supports_delivery: bool = True


class BranchUpdate(BaseModel):
    address: str | None = Field(default=None, min_length=1, max_length=500)
    phone: str | None = Field(default=None, max_length=20)
    is_active: bool | None = None
    supports_dine_in: bool | None = None
    supports_takeaway: bool | None = None
    supports_delivery: bool | None = None


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
    """A recipe line. Prefer `inventory_item_id`; a name creates the stock item if it doesn't exist."""

    inventory_item_id: UUID | None = None
    inventory_item_name: str | None = Field(default=None, min_length=1, max_length=150)
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    current_stock: Decimal = Field(default=Decimal("0"), ge=0)
    safety_stock_level: Decimal = Field(default=Decimal("0"), ge=0)
    reorder_delay_days: int = Field(default=0, ge=0)
    cost_per_unit: Decimal = Field(default=Decimal("0"), ge=0)
    shelf_life_days: int | None = Field(default=None, ge=0)
    quantity_per_unit: Decimal = Field(gt=0)

    @model_validator(mode="after")
    def identify_inventory_item(self):
        if self.inventory_item_id is None and not (self.inventory_item_name and self.unit):
            raise ValueError("Each ingredient needs an inventory_item_id, or an inventory_item_name and unit.")
        return self


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
    category: str | None = Field(default=None, max_length=100)
    food_type: str = Field(default="veg", pattern="^(veg|non-veg)$")
    image_url: str | None = None
    price: Decimal = Field(ge=0)
    is_active: bool = True
    ingredients: list[MenuItemIngredientCreate] = Field(default_factory=list)


class MenuItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    category: str | None = Field(default=None, max_length=100)
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


class InventoryItemCreate(BaseModel):
    branch_id: UUID
    name: str = Field(min_length=1, max_length=150)
    unit: str = Field(min_length=1, max_length=20)
    current_stock: Decimal = Field(default=Decimal("0"), ge=0)
    safety_stock_level: Decimal = Field(default=Decimal("0"), ge=0)
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


class InventoryMovementCreate(BaseModel):
    """Stock received from a supplier (PURCHASE) or thrown away (WASTE)."""

    type: Literal["PURCHASE", "WASTE"]
    quantity: Decimal = Field(gt=0)
    # For purchases: the price paid per unit. Updates the item's cost for recipe costing.
    unit_cost: Decimal | None = Field(default=None, ge=0)


class OrderItemResponse(BaseModel):
    id: UUID
    menu_item_id: UUID
    menu_item_name: str
    quantity: int
    unit_price: Decimal
    total_price: Decimal


class OrderItemCreate(BaseModel):
    menu_item_id: UUID
    quantity: int = Field(gt=0, le=100)


class OrderCreate(BaseModel):
    branch_id: UUID
    order_type: OrderType = "DINE_IN"
    customer_id: UUID | None = None
    items: list[OrderItemCreate] = Field(min_length=1)


class OrderResponse(BaseModel):
    id: UUID
    branch_id: UUID
    customer_id: UUID | None
    customer_name: str | None = None
    customer_phone: str | None = None
    order_source: str
    order_type: str
    status: str
    total_amount: Decimal
    ordered_at: datetime
    items: list[OrderItemResponse]
    inventory_warnings: list[str] = Field(default_factory=list)


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


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
    module_code: str
    module_name: str
    status: str
    start_date: datetime
    end_date: datetime | None


class SubscriptionUpdate(BaseModel):
    """The complete set of modules the restaurant wants active."""

    module_codes: list[str] = Field(default_factory=list, max_length=20)


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
    # The Supabase Auth user id of the staff login. Required so the profile
    # matches the account the staff member actually signs in with.
    user_id: UUID
    name: str = Field(min_length=1, max_length=150)
    email: str = Field(min_length=3, max_length=255)
    role: StaffRole

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class StaffMemberUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    role: StaffRole | None = None
    is_active: bool | None = None
