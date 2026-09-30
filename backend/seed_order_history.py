from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
from random import Random
from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy import select

from app.database import SessionLocal
from app.demo import DEMO_RESTAURANT_ID
from app.services.reporting import business_tz, local_today
from app.models.branch import Branch
from app.models.menu_item import MenuItem
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.restaurant import Restaurant


SEED_NAMESPACE = uuid5(NAMESPACE_URL, "https://rasoi-sathi.local/demo-order-history")


def stable_id(kind: str, value: str) -> UUID:
    return uuid5(SEED_NAMESPACE, f"{kind}:{value}")


def seed() -> None:
    random = Random(20260822)
    today = local_today()

    with SessionLocal() as db:
        # Your own workspace: the oldest restaurant that isn't the public demo.
        restaurant = db.scalar(select(Restaurant).where(Restaurant.id != DEMO_RESTAURANT_ID).order_by(Restaurant.created_at).limit(1))
        if restaurant is None:
            raise RuntimeError("No restaurant yet. Sign up in the app first (it creates your restaurant), then run this again.")

        branches = db.scalars(
            select(Branch)
            .where(Branch.restaurant_id == restaurant.id, Branch.is_active.is_(True))
            .order_by(Branch.created_at)
        ).all()
        menu_items = db.scalars(
            select(MenuItem)
            .where(MenuItem.restaurant_id == restaurant.id, MenuItem.is_active.is_(True))
            .order_by(MenuItem.name)
        ).all()
        if not branches or not menu_items:
            raise RuntimeError("Seed branches and menu items before creating order history.")
        menu_by_id = {menu_item.id: menu_item for menu_item in menu_items}

        source_weights = [("POS", 48), ("WHATSAPP", 27), ("SWIGGY", 15), ("ZOMATO", 10)]
        source_values = [source for source, weight in source_weights for _ in range(weight)]
        menu_weights = {
            "Chicken Biryani": 18,
            "Paneer Pakora": 10,
            "Veg Pakora": 8,
            "Chicken Tikka": 11,
            "Butter Chicken": 12,
            "Dal Tadka": 8,
            "Veg Thali": 10,
            "Masala Chai": 9,
            "Mango Lassi": 7,
            "Gulab Jamun": 7,
        }
        weighted_menu = [
            menu_item
            for menu_item in menu_items
            for _ in range(menu_weights.get(menu_item.name, 5))
        ]

        created_orders = 0
        created_items = 0
        for days_ago in range(27, -1, -1):
            service_date = today - timedelta(days=days_ago)
            order_count = 10 + random.randint(0, 10)
            for order_number in range(order_count):
                order_key = f"{service_date.isoformat()}:{order_number}"
                order_id = stable_id("order", order_key)
                if db.get(Order, order_id) is not None:
                    continue

                branch = branches[0] if len(branches) == 1 or random.random() < 0.68 else branches[1]
                source = random.choice(source_values)
                order_type = "DINE_IN" if source == "POS" and random.random() < 0.72 else "TAKEAWAY"
                if source in {"SWIGGY", "ZOMATO"}:
                    order_type = "DELIVERY"
                hour = random.choices([11, 12, 13, 14, 18, 19, 20, 21], weights=[4, 7, 11, 5, 6, 10, 9, 5])[0]
                minute = random.randrange(0, 60)
                # Lunch/dinner hours are local restaurant time, stored as UTC.
                ordered_at = datetime.combine(service_date, time(hour, minute), tzinfo=business_tz()).astimezone(timezone.utc)

                selected = [random.choice(weighted_menu)]
                if random.random() < 0.52:
                    selected.append(random.choice(weighted_menu))
                if random.random() < 0.16:
                    selected.append(random.choice(weighted_menu))

                quantities = {}
                for menu_item in selected:
                    quantities[menu_item.id] = quantities.get(menu_item.id, 0) + random.choices([1, 2, 3], weights=[72, 24, 4])[0]

                total = sum((menu_by_id[menu_item_id].price * quantity for menu_item_id, quantity in quantities.items()), Decimal("0"))
                order = Order(
                    id=order_id,
                    restaurant_id=restaurant.id,
                    branch_id=branch.id,
                    order_source=source,
                    order_type=order_type,
                    status="COMPLETED",
                    total_amount=total,
                    ordered_at=ordered_at,
                )
                db.add(order)
                db.flush()
                for menu_item_id, quantity in quantities.items():
                    menu_item = menu_by_id[menu_item_id]
                    db.add(OrderItem(
                        id=stable_id("order-item", f"{order_key}:{menu_item_id}"),
                        order_id=order.id,
                        menu_item_id=menu_item.id,
                        quantity=quantity,
                        unit_price=menu_item.price,
                        total_price=menu_item.price * quantity,
                    ))
                    created_items += 1
                created_orders += 1

        db.commit()
        print(f"Created {created_orders} completed historical orders and {created_items} order items across 28 days.")


if __name__ == "__main__":
    seed()
