from datetime import datetime, timedelta
import random

from app.database import engine, SessionLocal, Base
from app.models import (
    Restaurant,
    Product,
    Sale,
    SaleItem,
    Expense,
    Inventory
)


Base.metadata.create_all(bind=engine)

db = SessionLocal()

restaurant = Restaurant(
    name="Spice Garden",
    location="Mumbai"
)

db.add(restaurant)
db.commit()
db.refresh(restaurant)


products = [
    Product(
        restaurant_id=restaurant.id,
        name="Chicken Biryani",
        category="Main Course",
        selling_price=180,
        cost_price=98
    ),
    Product(
        restaurant_id=restaurant.id,
        name="Paneer Biryani",
        category="Main Course",
        selling_price=160,
        cost_price=85
    ),
    Product(
        restaurant_id=restaurant.id,
        name="Butter Chicken",
        category="Main Course",
        selling_price=240,
        cost_price=130
    ),
    Product(
        restaurant_id=restaurant.id,
        name="Masala Dosa",
        category="Breakfast",
        selling_price=100,
        cost_price=40
    ),
    Product(
        restaurant_id=restaurant.id,
        name="Mango Lassi",
        category="Beverage",
        selling_price=80,
        cost_price=25
    )
]

db.add_all(products)
db.commit()

for product in products:

    inventory = Inventory(
        product_id=product.id,
        quantity=random.randint(30, 200)
    )

    db.add(inventory)


for i in range(30):

    date = datetime.now() - timedelta(days=29 - i)

    sale = Sale(
        restaurant_id=restaurant.id,
        date=date,
        total_amount=0
    )

    db.add(sale)
    db.commit()
    db.refresh(sale)

    total = 0

    for product in products:

        quantity = random.randint(0, 20)

        if quantity == 0:
            continue

        item = SaleItem(
            sale_id=sale.id,
            product_id=product.id,
            quantity=quantity,
            price=product.selling_price
        )

        db.add(item)

        total += quantity * product.selling_price

    sale.total_amount = total

    db.commit()


categories = [
    "Electricity",
    "Rent",
    "Staff",
    "Maintenance",
    "Marketing"
]

for i in range(20):

    expense = Expense(
        restaurant_id=restaurant.id,
        category=random.choice(categories),
        amount=random.randint(500, 5000),
        date=datetime.now() - timedelta(
            days=random.randint(0, 29)
        )
    )

    db.add(expense)

db.commit()
db.close()

print("Database created successfully.")