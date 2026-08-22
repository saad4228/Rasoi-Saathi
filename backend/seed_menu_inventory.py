from decimal import Decimal

from sqlalchemy import select

from app.database import SessionLocal
from app.models.branch import Branch
from app.models.inventory_item import InventoryItem
from app.models.menu_item import MenuItem
from app.models.menu_item_ingredient import MenuItemIngredient
from app.models.restaurant import Restaurant


INVENTORY = [
    ("Basmati Rice", "kg", "38", "12", 3, "92.00", 180),
    ("Chicken", "kg", "18", "8", 2, "245.00", 3),
    ("Paneer", "kg", "9", "4", 2, "360.00", 5),
    ("Potatoes", "kg", "24", "8", 3, "38.00", 14),
    ("Onions", "kg", "30", "10", 3, "32.00", 14),
    ("Tomatoes", "kg", "20", "7", 2, "45.00", 7),
    ("Cooking Oil", "litre", "18", "6", 4, "145.00", 90),
    ("Gram Flour", "kg", "12", "4", 5, "95.00", 120),
    ("Lentils", "kg", "16", "5", 5, "130.00", 180),
    ("Milk", "litre", "22", "8", 1, "62.00", 5),
    ("Tea Leaves", "kg", "3", "1", 7, "520.00", 365),
    ("Sugar", "kg", "20", "6", 5, "48.00", 365),
    ("Mango Pulp", "litre", "8", "3", 4, "180.00", 30),
    ("Wheat Flour", "kg", "18", "6", 4, "48.00", 120),
    ("Cardamom", "kg", "2", "0.5", 7, "1400.00", 365),
]

MENU = [
    ("Chicken Biryani", "Mains", "289.00", "Aromatic basmati rice layered with spiced chicken.", {"Basmati Rice": "0.220", "Chicken": "0.180", "Onions": "0.060", "Cooking Oil": "0.015"}),
    ("Paneer Pakora", "Starters", "169.00", "Crisp gram flour fritters with soft paneer.", {"Paneer": "0.150", "Gram Flour": "0.080", "Cooking Oil": "0.030"}),
    ("Veg Pakora", "Starters", "129.00", "Seasonal vegetables in a crisp gram flour batter.", {"Potatoes": "0.080", "Onions": "0.060", "Gram Flour": "0.090", "Cooking Oil": "0.030"}),
    ("Chicken Tikka", "Starters", "249.00", "Charred, smoky chicken tikka with house spices.", {"Chicken": "0.220", "Onions": "0.030", "Tomatoes": "0.030"}),
    ("Butter Chicken", "Mains", "279.00", "Creamy tomato chicken curry with warming spices.", {"Chicken": "0.200", "Tomatoes": "0.120", "Onions": "0.060", "Cooking Oil": "0.020"}),
    ("Dal Tadka", "Mains", "159.00", "Yellow lentils finished with a fragrant tempering.", {"Lentils": "0.180", "Tomatoes": "0.040", "Onions": "0.040", "Cooking Oil": "0.012"}),
    ("Veg Thali", "Mains", "229.00", "A balanced thali with rice, dal, vegetables, and paneer.", {"Basmati Rice": "0.120", "Lentils": "0.080", "Paneer": "0.070", "Potatoes": "0.080"}),
    ("Masala Chai", "Beverages", "59.00", "Indian tea brewed with milk, sugar, and cardamom.", {"Milk": "0.150", "Tea Leaves": "0.006", "Sugar": "0.012", "Cardamom": "0.001"}),
    ("Mango Lassi", "Beverages", "119.00", "Chilled yogurt-style mango drink.", {"Milk": "0.180", "Mango Pulp": "0.080", "Sugar": "0.015"}),
    ("Gulab Jamun", "Desserts", "99.00", "Soft syrup-soaked milk dumplings.", {"Wheat Flour": "0.040", "Milk": "0.040", "Sugar": "0.030", "Cooking Oil": "0.020"}),
]


def seed() -> None:
    with SessionLocal() as db:
        restaurant = db.scalar(select(Restaurant).order_by(Restaurant.created_at).limit(1))
        if restaurant is None:
            raise RuntimeError("No restaurant exists. Run the restaurant onboarding seed first.")

        branch = db.scalar(
            select(Branch)
            .where(Branch.restaurant_id == restaurant.id, Branch.is_active.is_(True))
            .order_by(Branch.created_at)
            .limit(1)
        )
        if branch is None:
            raise RuntimeError("No active branch exists for the first restaurant.")

        inventory_by_name = {}
        for name, unit, stock, safety, delay, cost, shelf_life in INVENTORY:
            item = db.scalar(
                select(InventoryItem).where(
                    InventoryItem.branch_id == branch.id,
                    InventoryItem.name == name,
                )
            )
            if item is None:
                item = InventoryItem(
                    branch_id=branch.id,
                    name=name,
                    unit=unit,
                    current_stock=Decimal(stock),
                    safety_stock_level=Decimal(safety),
                    reorder_delay_days=delay,
                    cost_per_unit=Decimal(cost),
                    shelf_life_days=shelf_life,
                )
                db.add(item)
                db.flush()
            inventory_by_name[name] = item

        for name, category, price, description, recipe in MENU:
            item = db.scalar(
                select(MenuItem).where(
                    MenuItem.restaurant_id == restaurant.id,
                    MenuItem.name == name,
                )
            )
            if item is None:
                item = MenuItem(
                    restaurant_id=restaurant.id,
                    name=name,
                    category=category,
                    description=description,
                    price=Decimal(price),
                    is_active=True,
                    image_url=None,
                )
                db.add(item)
                db.flush()

            for ingredient_name, quantity in recipe.items():
                inventory_item = inventory_by_name[ingredient_name]
                link = db.scalar(
                    select(MenuItemIngredient).where(
                        MenuItemIngredient.menu_item_id == item.id,
                        MenuItemIngredient.inventory_item_id == inventory_item.id,
                    )
                )
                if link is None:
                    db.add(MenuItemIngredient(
                        menu_item_id=item.id,
                        inventory_item_id=inventory_item.id,
                        quantity_per_unit=Decimal(quantity),
                    ))

        db.commit()
        print(f"Seeded {len(INVENTORY)} inventory items and {len(MENU)} menu items for {branch.address}.")


if __name__ == "__main__":
    seed()
