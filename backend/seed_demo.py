from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, TypeVar
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.branch import Branch
from app.models.demand_forecast import DemandForecast
from app.models.inventory_item import InventoryItem
from app.models.inventory_transaction import InventoryTransaction
from app.models.menu_item import MenuItem
from app.models.menu_item_ingredient import MenuItemIngredient
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.purchase_order import PurchaseOrder
from app.models.purchase_order_item import PurchaseOrderItem
from app.models.restaurant import Restaurant
from app.models.restaurant_module import RestaurantModule
from app.models.subscription import Subscription
from app.models.user import User

T = TypeVar("T")

DEMO_RESTAURANT_ID = UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a001")
AUTH_OWNER_ID = UUID("bfb5c22c-5166-4e35-9930-b54755ef0fa8")

BRANCH_IDS = {
    "central": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a002"),
    "riverside": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a003"),
}
MODULE_IDS = {
    "whatsapp": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a010"),
    "aggregators": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a011"),
    "inventory": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a012"),
    "copilot": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a013"),
    "multi_branch": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a014"),
}
USER_IDS = {
    "owner": AUTH_OWNER_ID,
    "chef": UUID("6af7d9ca-3fb5-4be2-b75b-626ad65b9957"),
    "waiter": UUID("e1a4072c-db6a-446d-81c0-640e71a08bb4"),
    "chef_demo": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a021"),
    "waiter_one": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a022"),
    "waiter_two": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a023"),
}
MENU_IDS = {
    "biryani": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a030"),
    "paneer": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a031"),
    "thali": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a032"),
    "tikka": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a033"),
    "lassi": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a034"),
    "gulab_jamun": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a035"),
}
INVENTORY_IDS = {
    "rice_central": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a040"),
    "chicken_central": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a041"),
    "paneer_central": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a042"),
    "oil_central": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a043"),
    "rice_riverside": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a044"),
    "chicken_riverside": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a045"),
    "paneer_riverside": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a046"),
    "oil_riverside": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a047"),
}
ORDER_IDS = {
    "central_one": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a050"),
    "central_two": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a051"),
    "riverside_one": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a052"),
    "riverside_two": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a053"),
}
PO_IDS = {
    "central": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a060"),
    "riverside": UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a061"),
}

CREATED: dict[str, int] = {}


def get_or_create(session: Session, model: type[T], object_id: UUID, **values: Any) -> T:
    instance = session.get(model, object_id)
    if instance is None:
        instance = model(id=object_id, **values)
        session.add(instance)
        CREATED[model.__tablename__] = CREATED.get(model.__tablename__, 0) + 1
    return instance


def seed(session: Session) -> None:
    now = datetime.now(timezone.utc)
    today = now.date()

    restaurant = get_or_create(
        session,
        Restaurant,
        DEMO_RESTAURANT_ID,
        name="Saffron Junction",
        email="hello@saffronjunction.demo",
        phone="+91-712-400-2200",
    )

    branches = {
        "central": get_or_create(
            session,
            Branch,
            BRANCH_IDS["central"],
            restaurant_id=restaurant.id,
            address="12 Central Market, Nagpur",
            phone="+91-712-400-2201",
            is_active=True,
            supports_dine_in=True,
            supports_takeaway=True,
            supports_delivery=True,
        ),
        "riverside": get_or_create(
            session,
            Branch,
            BRANCH_IDS["riverside"],
            restaurant_id=restaurant.id,
            address="8 Riverside Road, Nagpur",
            phone="+91-712-400-2202",
            is_active=True,
            supports_dine_in=True,
            supports_takeaway=True,
            supports_delivery=False,
        ),
    }

    modules_data = [
        ("whatsapp", "WhatsApp Ordering", "WHATSAPP", Decimal("399.00")),
        ("aggregators", "Aggregator Management", "AGGREGATORS", Decimal("599.00")),
        ("inventory", "Inventory Intelligence", "INVENTORY", Decimal("399.00")),
        ("copilot", "AI Copilot", "AI_COPILOT", Decimal("599.00")),
        ("multi_branch", "Multi-Branch", "MULTI_BRANCH", Decimal("799.00")),
    ]
    modules = {}
    for key, name, code, price in modules_data:
        modules[key] = get_or_create(
            session,
            RestaurantModule,
            MODULE_IDS[key],
            name=name,
            code=code,
            description=f"{name} for Saffron Junction",
            price=price,
        )

    for module in modules.values():
        get_or_create(
            session,
            Subscription,
            UUID(f"2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a1{list(modules.values()).index(module):02d}"),
            restaurant_id=restaurant.id,
            module_id=module.id,
            status="ACTIVE",
            start_date=now - timedelta(days=45),
        )

    user_data = [
        ("owner", "Sambodhi Bhowal", "sambodhibhowal@gmail.com", "owner"),
        ("chef", "Head Chef", "chef@saffronjunction.demo", "chef"),
        ("waiter", "Main Waiter", "waiter@saffronjunction.demo", "waiter"),
        ("chef_demo", "Mira Kulkarni", "mira@saffronjunction.demo", "chef"),
        ("waiter_one", "Rohan Patil", "rohan@saffronjunction.demo", "waiter"),
        ("waiter_two", "Isha Deshmukh", "isha@saffronjunction.demo", "waiter"),
    ]
    for key, name, email, role in user_data:
        get_or_create(
            session,
            User,
            USER_IDS[key],
            restaurant_id=restaurant.id,
            email=email,
            name=name,
            role=role,
            is_active=True,
        )

    menu_data = [
        ("biryani", "Chicken Biryani", "Rice Bowls", Decimal("260.00")),
        ("paneer", "Paneer Tikka Masala", "Main Course", Decimal("240.00")),
        ("thali", "Saffron Veg Thali", "Main Course", Decimal("220.00")),
        ("tikka", "Tandoori Chicken Tikka", "Starters", Decimal("280.00")),
        ("lassi", "Kesar Lassi", "Beverages", Decimal("110.00")),
        ("gulab_jamun", "Gulab Jamun", "Desserts", Decimal("90.00")),
    ]
    menu_items = {}
    for key, name, category, price in menu_data:
        menu_items[key] = get_or_create(
            session,
            MenuItem,
            MENU_IDS[key],
            restaurant_id=restaurant.id,
            name=name,
            description=f"House special {name.lower()}.",
            category=category,
            price=price,
            is_active=True,
        )

    inventory_data = [
        ("rice_central", "central", "Basmati Rice", "kg", "42.000", "15.000", 3, "92.00"),
        ("chicken_central", "central", "Chicken", "kg", "28.000", "10.000", 2, "245.00"),
        ("paneer_central", "central", "Paneer", "kg", "14.000", "5.000", 2, "360.00"),
        ("oil_central", "central", "Sunflower Oil", "litre", "18.000", "6.000", 4, "145.00"),
        ("rice_riverside", "riverside", "Basmati Rice", "kg", "31.000", "12.000", 3, "92.00"),
        ("chicken_riverside", "riverside", "Chicken", "kg", "19.000", "8.000", 2, "245.00"),
        ("paneer_riverside", "riverside", "Paneer", "kg", "10.000", "4.000", 2, "360.00"),
        ("oil_riverside", "riverside", "Sunflower Oil", "litre", "12.000", "5.000", 4, "145.00"),
    ]
    inventory_items = {}
    for key, branch_key, name, unit, stock, safety, delay, cost in inventory_data:
        inventory_items[key] = get_or_create(
            session,
            InventoryItem,
            INVENTORY_IDS[key],
            branch_id=branches[branch_key].id,
            name=name,
            unit=unit,
            current_stock=Decimal(stock),
            safety_stock_level=Decimal(safety),
            reorder_delay_days=delay,
            cost_per_unit=Decimal(cost),
        )

    ingredient_data = [
        ("biryani", "rice_central", "0.220"),
        ("biryani", "chicken_central", "0.180"),
        ("biryani", "oil_central", "0.015"),
        ("paneer", "paneer_central", "0.180"),
        ("paneer", "oil_central", "0.012"),
        ("tikka", "chicken_central", "0.220"),
        ("thali", "rice_central", "0.150"),
        ("thali", "paneer_central", "0.080"),
        ("biryani", "rice_riverside", "0.220"),
        ("biryani", "chicken_riverside", "0.180"),
        ("paneer", "paneer_riverside", "0.180"),
        ("tikka", "chicken_riverside", "0.220"),
    ]
    for index, (menu_key, inventory_key, quantity) in enumerate(ingredient_data, start=1):
        get_or_create(
            session,
            MenuItemIngredient,
            UUID(f"2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a3{index:02d}"),
            menu_item_id=menu_items[menu_key].id,
            inventory_item_id=inventory_items[inventory_key].id,
            quantity_per_unit=Decimal(quantity),
        )

    order_data = [
        ("central_one", "central", "POS", "DINE_IN", "COMPLETED", Decimal("610.00"), [
            ("biryani", 2, Decimal("260.00"), Decimal("520.00")),
            ("lassi", 1, Decimal("90.00"), Decimal("90.00")),
        ]),
        ("central_two", "central", "WHATSAPP", "TAKEAWAY", "READY", Decimal("520.00"), [
            ("paneer", 1, Decimal("240.00"), Decimal("240.00")),
            ("tikka", 1, Decimal("280.00"), Decimal("280.00")),
        ]),
        ("riverside_one", "riverside", "SWIGGY", "DELIVERY", "COMPLETED", Decimal("440.00"), [
            ("thali", 2, Decimal("220.00"), Decimal("440.00")),
        ]),
        ("riverside_two", "riverside", "ZOMATO", "DELIVERY", "CONFIRMED", Decimal("370.00"), [
            ("biryani", 1, Decimal("260.00"), Decimal("260.00")),
            ("gulab_jamun", 1, Decimal("90.00"), Decimal("90.00")),
            ("lassi", 1, Decimal("20.00"), Decimal("20.00")),
        ]),
    ]
    orders = {}
    for index, (key, branch_key, source, order_type, status, total, items) in enumerate(order_data, start=1):
        order = get_or_create(
            session,
            Order,
            ORDER_IDS[key],
            restaurant_id=restaurant.id,
            branch_id=branches[branch_key].id,
            order_source=source,
            order_type=order_type,
            status=status,
            total_amount=total,
            ordered_at=now - timedelta(days=index),
        )
        orders[key] = order
        for item_index, (menu_key, quantity, unit_price, total_price) in enumerate(items, start=1):
            get_or_create(
                session,
                OrderItem,
                UUID(f"2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a5{index}{item_index}"),
                order_id=order.id,
                menu_item_id=menu_items[menu_key].id,
                quantity=quantity,
                unit_price=unit_price,
                total_price=total_price,
            )

    transaction_data = [
        ("central", "rice_central", "PURCHASE", "40.000", "92.00", "2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a050"),
        ("central", "chicken_central", "PURCHASE", "30.000", "245.00", "2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a050"),
        ("central", "chicken_central", "CONSUMPTION", "-5.000", "245.00", None),
        ("central", "oil_central", "WASTE", "-1.000", "145.00", None),
        ("riverside", "rice_riverside", "PURCHASE", "30.000", "92.00", "2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a061"),
        ("riverside", "chicken_riverside", "PURCHASE", "20.000", "245.00", "2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a061"),
        ("riverside", "paneer_riverside", "ADJUSTMENT", "2.000", "360.00", None),
        ("riverside", "oil_riverside", "CONSUMPTION", "-2.000", "145.00", None),
    ]
    for index, (branch_key, inventory_key, transaction_type, quantity, unit_cost, reference_id) in enumerate(transaction_data, start=1):
        get_or_create(
            session,
            InventoryTransaction,
            UUID(f"2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a4{index:02d}"),
            inventory_item_id=inventory_items[inventory_key].id,
            branch_id=branches[branch_key].id,
            transaction_type=transaction_type,
            quantity=Decimal(quantity),
            unit_cost=Decimal(unit_cost),
            reference_id=UUID(reference_id) if reference_id else None,
        )

    forecast_data = [
        ("central", "biryani", 0, "42.00"),
        ("central", "paneer", 0, "24.00"),
        ("central", "tikka", 0, "18.00"),
        ("central", "biryani", 1, "46.00"),
        ("central", "paneer", 1, "26.00"),
        ("central", "tikka", 1, "20.00"),
        ("riverside", "biryani", 0, "34.00"),
        ("riverside", "thali", 0, "22.00"),
        ("riverside", "tikka", 0, "16.00"),
        ("riverside", "biryani", 1, "37.00"),
        ("riverside", "thali", 1, "25.00"),
        ("riverside", "tikka", 1, "18.00"),
    ]
    for index, (branch_key, menu_key, day_offset, quantity) in enumerate(forecast_data, start=1):
        get_or_create(
            session,
            DemandForecast,
            UUID(f"2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a7{index:02d}"),
            branch_id=branches[branch_key].id,
            menu_item_id=menu_items[menu_key].id,
            forecast_date=today + timedelta(days=day_offset + 1),
            predicted_quantity=Decimal(quantity),
        )

    purchase_order_data = [
        ("central", "PENDING", Decimal("2840.00"), [
            ("rice_central", "20.000", "92.00", "1840.00"),
            ("chicken_central", "4.000", "245.00", "1000.00"),
        ]),
        ("riverside", "ORDERED", Decimal("1450.00"), [
            ("oil_riverside", "10.000", "145.00", "1450.00"),
        ]),
    ]
    for index, (branch_key, status, total, items) in enumerate(purchase_order_data, start=1):
        purchase_order = get_or_create(
            session,
            PurchaseOrder,
            PO_IDS[branch_key],
            branch_id=branches[branch_key].id,
            status=status,
            total_amount=total,
        )
        for item_index, (inventory_key, quantity, unit_cost, total_price) in enumerate(items, start=1):
            get_or_create(
                session,
                PurchaseOrderItem,
                UUID(f"2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a6{index}{item_index}"),
                purchase_order_id=purchase_order.id,
                inventory_item_id=inventory_items[inventory_key].id,
                quantity=Decimal(quantity),
                unit_cost=Decimal(unit_cost),
                total_price=Decimal(total_price),
            )


def main() -> None:
    with SessionLocal() as session:
        try:
            seed(session)
            session.commit()
        except Exception:
            session.rollback()
            raise

    print("Demo seed complete")
    for table_name in (
        "restaurants",
        "branches",
        "restaurant_modules",
        "subscriptions",
        "users",
        "menu_items",
        "inventory_items",
        "menu_item_ingredients",
        "orders",
        "order_items",
        "inventory_transactions",
        "demand_forecasts",
        "purchase_orders",
        "purchase_order_items",
    ):
        print(f"{table_name}: {CREATED.get(table_name, 0)} created")


if __name__ == "__main__":
    main()
