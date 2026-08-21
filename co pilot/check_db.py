from app.database import SessionLocal
from app.models import Product, SaleItem


db = SessionLocal()

print("\nPRODUCTS")
print("=" * 40)

products = db.query(Product).all()

for product in products:
    print(
        product.id,
        product.name,
        product.selling_price,
        product.cost_price
    )


print("\nSALES")
print("=" * 40)

sales = db.query(SaleItem).all()

for sale in sales:
    print(
        "Product ID:",
        sale.product_id,
        "Quantity:",
        sale.quantity
    )


db.close()