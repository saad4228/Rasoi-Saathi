from app.database import SessionLocal
from app.models import (
    Restaurant,
    Product,
    Sale,
    SaleItem,
    Expense,
    Inventory
)


db = SessionLocal()

try:

    print("\n" + "=" * 60)
    print("RESTAURANTS")
    print("=" * 60)

    restaurants = db.query(Restaurant).all()

    for restaurant in restaurants:
        print(
            f"ID: {restaurant.id} | "
            f"Name: {restaurant.name} | "
            f"Location: {restaurant.location}"
        )


    print("\n" + "=" * 60)
    print("PRODUCTS")
    print("=" * 60)

    products = db.query(Product).all()

    for product in products:
        print(
            f"ID: {product.id} | "
            f"Restaurant ID: {product.restaurant_id} | "
            f"Name: {product.name} | "
            f"Category: {product.category} | "
            f"Selling Price: ₹{product.selling_price} | "
            f"Cost Price: ₹{product.cost_price}"
        )


    print("\n" + "=" * 60)
    print("SALES")
    print("=" * 60)

    sales = db.query(Sale).all()

    for sale in sales:
        print(
            f"ID: {sale.id} | "
            f"Restaurant ID: {sale.restaurant_id} | "
            f"Amount: ₹{sale.total_amount} | "
            f"Date: {sale.date}"
        )


    print("\n" + "=" * 60)
    print("SALE ITEMS")
    print("=" * 60)

    sale_items = db.query(SaleItem).all()

    for item in sale_items:
        print(
            f"ID: {item.id} | "
            f"Sale ID: {item.sale_id} | "
            f"Product ID: {item.product_id} | "
            f"Quantity: {item.quantity} | "
            f"Price: ₹{item.price}"
        )


    print("\n" + "=" * 60)
    print("EXPENSES")
    print("=" * 60)

    expenses = db.query(Expense).all()

    for expense in expenses:
        print(
            f"ID: {expense.id} | "
            f"Restaurant ID: {expense.restaurant_id} | "
            f"Category: {expense.category} | "
            f"Amount: ₹{expense.amount} | "
            f"Date: {expense.date}"
        )


    print("\n" + "=" * 60)
    print("INVENTORY")
    print("=" * 60)

    inventory = db.query(Inventory).all()

    for item in inventory:
        print(
            f"ID: {item.id} | "
            f"Product ID: {item.product_id} | "
            f"Quantity: {item.quantity}"
        )


finally:

    db.close()