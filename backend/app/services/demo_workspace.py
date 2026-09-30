"""Builds the public demo workspace ("Saffron Junction") and keeps it fresh.

`seed_demo.py` creates the demo logins in Supabase and calls `build_demo` the first time. After
that the API rebuilds the data by itself (`refresh_demo_in_background`, started when the login
page asks for the demo accounts), so "today" never goes empty and visitors' changes don't pile up.
"""
from __future__ import annotations

import logging
import threading
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
from random import Random
from uuid import UUID, uuid4

from sqlalchemy import Engine, delete, select
from sqlalchemy.orm import Session

from app.demo import DEMO_ACCOUNTS, DEMO_EMAIL_DOMAIN, DEMO_RESTAURANT_ID, DEMO_RESTAURANT_NAME
from app.models import (
    Branch, Customer, DemandForecast, InventoryItem, InventoryTransaction, MenuItem, MenuItemIngredient, Order, OrderItem,
    PurchaseOrder, PurchaseOrderItem, Restaurant, RestaurantModule, Subscription, User,
)
from app.services.reporting import business_tz, local_date, local_today

logger = logging.getLogger(__name__)

# Live tickets and "today" figures are relative to when the demo was built, so rebuild it this often.
DEMO_REFRESH_AFTER = timedelta(hours=3)

BRANCHES = {
    # key: (address, phone, dine-in, takeaway, delivery)
    "central": ("12 Central Market, Nagpur", "+91 712 400 2201", True, True, True),
    "riverside": ("8 Riverside Road, Nagpur", "+91 712 400 2202", True, True, False),
}

# name, unit, stock at central, stock at riverside, safety level, supplier lead days, cost per unit, shelf life days
INVENTORY = [
    ("Basmati Rice", "kg", "38", "22", "12", 3, "92.00", 180),
    ("Chicken", "kg", "16", "7", "8", 1, "245.00", 3),
    ("Paneer", "kg", "3.5", "6", "4", 2, "360.00", 5),
    ("Potatoes", "kg", "24", "15", "8", 3, "38.00", 14),
    ("Onions", "kg", "30", "18", "10", 3, "32.00", 14),
    ("Tomatoes", "kg", "20", "4", "7", 2, "45.00", 7),
    ("Cooking Oil", "litre", "18", "10", "6", 4, "145.00", 90),
    ("Gram Flour", "kg", "12", "8", "4", 5, "95.00", 120),
    ("Lentils", "kg", "16", "9", "5", 5, "130.00", 180),
    ("Milk", "litre", "22", "12", "8", 1, "62.00", 5),
    ("Yogurt", "kg", "10", "6", "4", 1, "80.00", 7),
    ("Tea Leaves", "kg", "3", "2", "1", 7, "520.00", 365),
    ("Sugar", "kg", "20", "12", "6", 5, "48.00", 365),
    ("Wheat Flour", "kg", "18", "10", "6", 4, "48.00", 120),
    ("Cardamom", "kg", "1.2", "0.8", "0.5", 7, "1400.00", 365),
    ("Saffron", "g", "30", "15", "10", 10, "250.00", 365),
]

# name, category, price, food type, description, {ingredient: quantity per dish}
MENU = [
    ("Chicken Biryani", "Mains", "289.00", "non-veg", "Aromatic basmati rice layered with spiced chicken.",
     {"Basmati Rice": "0.22", "Chicken": "0.18", "Onions": "0.06", "Cooking Oil": "0.015"}),
    ("Butter Chicken", "Mains", "279.00", "non-veg", "Creamy tomato chicken curry with warming spices.",
     {"Chicken": "0.20", "Tomatoes": "0.12", "Onions": "0.06", "Cooking Oil": "0.02"}),
    ("Dal Tadka", "Mains", "159.00", "veg", "Yellow lentils finished with a fragrant tempering.",
     {"Lentils": "0.18", "Tomatoes": "0.04", "Onions": "0.04", "Cooking Oil": "0.012"}),
    ("Veg Thali", "Mains", "229.00", "veg", "Rice, dal, seasonal vegetables and paneer.",
     {"Basmati Rice": "0.12", "Lentils": "0.08", "Paneer": "0.07", "Potatoes": "0.08"}),
    ("Chicken Tikka", "Starters", "249.00", "non-veg", "Charred, smoky chicken tikka with house spices.",
     {"Chicken": "0.22", "Yogurt": "0.05", "Onions": "0.03"}),
    ("Paneer Pakora", "Starters", "169.00", "veg", "Crisp gram-flour fritters with soft paneer.",
     {"Paneer": "0.15", "Gram Flour": "0.08", "Cooking Oil": "0.03"}),
    ("Veg Pakora", "Starters", "129.00", "veg", "Seasonal vegetables in a crisp gram-flour batter.",
     {"Potatoes": "0.08", "Onions": "0.06", "Gram Flour": "0.09", "Cooking Oil": "0.03"}),
    ("Masala Chai", "Beverages", "59.00", "veg", "Indian tea brewed with milk, sugar and cardamom.",
     {"Milk": "0.15", "Tea Leaves": "0.006", "Sugar": "0.012", "Cardamom": "0.001"}),
    ("Kesar Lassi", "Beverages", "119.00", "veg", "Chilled saffron yogurt drink.",
     {"Yogurt": "0.18", "Milk": "0.05", "Sugar": "0.02", "Saffron": "0.05"}),
    ("Gulab Jamun", "Desserts", "99.00", "veg", "Soft syrup-soaked milk dumplings.",
     {"Wheat Flour": "0.04", "Milk": "0.04", "Sugar": "0.03", "Cooking Oil": "0.02"}),
]
POPULARITY = {"Chicken Biryani": 18, "Butter Chicken": 12, "Chicken Tikka": 11, "Paneer Pakora": 10, "Veg Thali": 10,
              "Masala Chai": 9, "Veg Pakora": 8, "Dal Tadka": 8, "Kesar Lassi": 7, "Gulab Jamun": 7}
SOURCES = [("POS", 48), ("WHATSAPP", 27), ("SWIGGY", 15), ("ZOMATO", 10)]


def wipe_demo(db: Session, login_ids: list[UUID]) -> None:
    rid = DEMO_RESTAURANT_ID
    branch_ids = select(Branch.id).where(Branch.restaurant_id == rid)
    menu_ids = select(MenuItem.id).where(MenuItem.restaurant_id == rid)
    order_ids = select(Order.id).where(Order.restaurant_id == rid)
    stock_ids = select(InventoryItem.id).where(InventoryItem.branch_id.in_(branch_ids))
    purchase_ids = select(PurchaseOrder.id).where(PurchaseOrder.branch_id.in_(branch_ids))
    for statement in (
        delete(OrderItem).where(OrderItem.order_id.in_(order_ids)),
        delete(Order).where(Order.restaurant_id == rid),
        delete(Customer).where(Customer.restaurant_id == rid),
        delete(InventoryTransaction).where(InventoryTransaction.inventory_item_id.in_(stock_ids)),
        delete(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id.in_(purchase_ids)),
        delete(PurchaseOrder).where(PurchaseOrder.id.in_(purchase_ids)),
        delete(MenuItemIngredient).where(MenuItemIngredient.menu_item_id.in_(menu_ids)),
        delete(DemandForecast).where(DemandForecast.menu_item_id.in_(menu_ids)),
        delete(InventoryItem).where(InventoryItem.id.in_(stock_ids)),
        delete(MenuItem).where(MenuItem.restaurant_id == rid),
        delete(Subscription).where(Subscription.restaurant_id == rid),
        # The demo logins belong to the demo only, even if someone signed up with one earlier.
        delete(User).where((User.restaurant_id == rid) | (User.id.in_(login_ids))),
        delete(Branch).where(Branch.restaurant_id == rid),
    ):
        db.execute(statement.execution_options(synchronize_session=False))
    db.expunge_all()  # forget rows loaded before the wipe, so the rebuilt logins don't clash with them


def local_moment(day, hour: int, minute: int) -> datetime:
    return datetime.combine(day, time(hour, minute), tzinfo=business_tz()).astimezone(timezone.utc)


def build_demo(db: Session, login_ids: dict[str, UUID], module_ids: list[UUID]) -> dict[str, int]:
    """Fill the (wiped) demo workspace. Ids are set up front so everything is inserted in a few batches."""
    rng = Random(20261001)
    now = datetime.now(timezone.utc)
    restaurant = db.get(Restaurant, DEMO_RESTAURANT_ID) or Restaurant(id=DEMO_RESTAURANT_ID)
    restaurant.name, restaurant.email, restaurant.phone = DEMO_RESTAURANT_NAME, f"hello@{DEMO_EMAIL_DOMAIN}", "+91 712 400 2200"
    restaurant.created_at = now  # doubles as "last rebuilt", see demo_is_stale
    db.add(restaurant)

    branches = {}
    for key, (address, phone, dine_in, takeaway, delivery) in BRANCHES.items():
        branches[key] = Branch(id=uuid4(), restaurant_id=restaurant.id, address=address, phone=phone, is_active=True,
                               supports_dine_in=dine_in, supports_takeaway=takeaway, supports_delivery=delivery)
    db.add_all(branches.values())

    stock = {}
    for name, unit, central, riverside, safety, lead, cost, shelf in INVENTORY:
        for key, level in (("central", central), ("riverside", riverside)):
            stock[key, name] = InventoryItem(id=uuid4(), branch_id=branches[key].id, name=name, unit=unit,
                                             current_stock=Decimal(level), safety_stock_level=Decimal(safety),
                                             reorder_delay_days=lead, cost_per_unit=Decimal(cost), shelf_life_days=shelf)
    db.add_all(stock.values())

    dishes = {}
    for name, category, price, food_type, description, recipe in MENU:
        dish = MenuItem(id=uuid4(), restaurant_id=restaurant.id, name=name, category=category, price=Decimal(price),
                        food_type=food_type, description=description, is_active=True)
        db.add(dish)
        dishes[name] = dish
        for key in branches:  # each outlet uses its own stock for the same recipe
            for ingredient, quantity in recipe.items():
                db.add(MenuItemIngredient(menu_item_id=dish.id, inventory_item_id=stock[key, ingredient].id, quantity_per_unit=Decimal(quantity)))

    weighted_menu = [dish for name, dish in dishes.items() for _ in range(POPULARITY[name])]
    weighted_sources = [source for source, weight in SOURCES for _ in range(weight)]

    def add_order(branch_key: str, status: str, ordered_at: datetime, source: str | None = None) -> None:
        source = source or rng.choice(weighted_sources)
        if source in ("SWIGGY", "ZOMATO") and branches[branch_key].supports_delivery:
            order_type = "DELIVERY"
        elif source in ("SWIGGY", "ZOMATO"):
            source, order_type = "POS", "TAKEAWAY"
        else:
            order_type = "DINE_IN" if source == "POS" and rng.random() < 0.7 else "TAKEAWAY"
        picked: dict[UUID, tuple[MenuItem, int]] = {}
        for _ in range(1 + (rng.random() < 0.5) + (rng.random() < 0.15)):
            dish = rng.choice(weighted_menu)
            count = rng.choices([1, 2, 3], weights=[72, 24, 4])[0]
            picked[dish.id] = (dish, picked.get(dish.id, (dish, 0))[1] + count)
        order = Order(id=uuid4(), restaurant_id=restaurant.id, branch_id=branches[branch_key].id, order_source=source,
                      order_type=order_type, status=status, ordered_at=ordered_at,
                      total_amount=sum((dish.price * qty for dish, qty in picked.values()), Decimal("0")))
        db.add(order)
        for dish, qty in picked.values():
            db.add(OrderItem(order_id=order.id, menu_item_id=dish.id, quantity=qty, unit_price=dish.price, total_price=dish.price * qty))

    today = local_today()
    history = 0
    for days_ago in range(28, 0, -1):
        day = today - timedelta(days=days_ago)
        weekend_boost = 5 if day.weekday() >= 5 else 0
        for _ in range(12 + weekend_boost + rng.randint(0, 8)):
            hour = rng.choices([12, 13, 14, 15, 19, 20, 21, 22], weights=[6, 11, 7, 3, 6, 10, 9, 4])[0]
            branch_key = "central" if rng.random() < 0.65 else "riverside"
            add_order(branch_key, "CANCELLED" if rng.random() < 0.03 else "COMPLETED", local_moment(day, hour, rng.randrange(60)))
            history += 1

    # Today: some finished sales plus live tickets for the kitchen and waiter screens.
    finished_today = (40, 75, 110, 150, 190, 240, 300)
    for minutes in finished_today:
        add_order("central" if minutes % 3 else "riverside", "COMPLETED", now - timedelta(minutes=minutes))
    live = [("central", "PENDING", 3, "WHATSAPP"), ("central", "PENDING", 6, "POS"), ("central", "PREPARING", 12, "SWIGGY"),
            ("central", "PREPARING", 18, "POS"), ("central", "READY", 22, "POS"), ("central", "READY", 27, "WHATSAPP"),
            ("riverside", "PENDING", 5, "POS"), ("riverside", "READY", 15, "POS")]
    for branch_key, status, minutes, source in live:
        add_order(branch_key, status, now - timedelta(minutes=minutes), source=source)

    # Stock movements, so the stock log and the analytics wastage figure aren't empty.
    for days_ago, key, name, kind, quantity in [
        (6, "central", "Chicken", "PURCHASE", "20"), (4, "central", "Basmati Rice", "PURCHASE", "25"),
        (5, "central", "Tomatoes", "WASTE", "-1.5"), (3, "riverside", "Milk", "WASTE", "-2"),
        (2, "central", "Paneer", "WASTE", "-0.6"), (1, "riverside", "Yogurt", "WASTE", "-0.8"),
    ]:
        item = stock[key, name]
        db.add(InventoryTransaction(inventory_item_id=item.id, branch_id=item.branch_id, transaction_type=kind,
                                    quantity=Decimal(quantity), unit_cost=item.cost_per_unit,
                                    created_at=local_moment(today - timedelta(days=days_ago), 10, 30)))

    for module_id in module_ids:
        db.add(Subscription(restaurant_id=restaurant.id, module_id=module_id, status="ACTIVE", start_date=now - timedelta(days=30)))

    for role, name, email in DEMO_ACCOUNTS:
        db.add(User(id=login_ids[role], restaurant_id=restaurant.id, email=email, name=name, role=role, is_active=True))

    db.flush()
    return {"orders": history + len(finished_today) + len(live), "dishes": len(dishes), "stock items": len(stock)}


# ─── Keeping it fresh ─────────────────────────────────────────────────────────

def demo_is_stale(db: Session) -> bool:
    built_at = db.scalar(select(Restaurant.created_at).where(Restaurant.id == DEMO_RESTAURANT_ID))
    if built_at is None:
        return False  # no demo yet: seed_demo.py creates it
    built_at = built_at if built_at.tzinfo else built_at.replace(tzinfo=timezone.utc)
    return local_date(built_at) != local_today() or datetime.now(timezone.utc) - built_at > DEMO_REFRESH_AFTER


def demo_login_ids(db: Session) -> dict[str, UUID] | None:
    """The existing demo logins by role, or None if any is missing (seed_demo.py creates them)."""
    by_email = dict(db.execute(select(User.email, User.id).where(User.restaurant_id == DEMO_RESTAURANT_ID)).all())
    ids = {role: by_email.get(email) for role, _, email in DEMO_ACCOUNTS}
    return ids if all(ids.values()) else None


_refresh_lock = threading.Lock()


def refresh_demo_if_stale(db: Session) -> bool:
    """Rebuild the demo data if it's from an earlier day or older than DEMO_REFRESH_AFTER.

    Uses the demo logins that already exist, so it needs no Supabase access. Returns True if it rebuilt.
    """
    if not demo_is_stale(db) or not _refresh_lock.acquire(blocking=False):
        return False  # fresh, or another request is already rebuilding it
    try:
        login_ids = demo_login_ids(db)
        if not login_ids:
            return False
        module_ids = list(db.scalars(select(RestaurantModule.id)).all())
        wipe_demo(db, list(login_ids.values()))
        build_demo(db, login_ids, module_ids)
        db.commit()
        logger.info("Demo workspace refreshed")
        return True
    except Exception:
        db.rollback()
        logger.exception("Couldn't refresh the demo workspace; keeping the old data")
        return False
    finally:
        _refresh_lock.release()


def refresh_demo_in_background(bind: Engine) -> None:
    """For BackgroundTasks: the request's own session is closed by the time this runs."""
    with Session(bind=bind, autoflush=False) as db:
        refresh_demo_if_stale(db)
