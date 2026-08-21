from app.database import SessionLocal
from app.analytics.profit import get_product_profit


db = SessionLocal()

result = get_product_profit(
    db,
    "Chicken Biryani"
)

print(result)

db.close()