"""
Verification script for the XGBoost-based inventory forecaster in backend/app/ml/forecaster.py
"""

from __future__ import annotations

import json
from sqlalchemy import select

from app.database import SessionLocal
from app.models.branch import Branch
from app.models.restaurant import Restaurant
from app.ml.forecaster import generate_reorder_alerts, resolve_category


def run_verification():
    print("=" * 60)
    print("RASOI SATHI: XGBoost Inventory Forecaster Verification")
    print("=" * 60)

    # 1. Test name resolution
    test_names = [
        "Basmati Rice",
        "Chicken",
        "Onions",
        "Tomatoes",
        "Cooking Oil",
        "Paneer",
        "Potatoes",
        "Tea Leaves",  # Unmapped
        "Mango Pulp",  # Unmapped
    ]
    print("\n[Step 1] Testing Category Name Resolution:")
    for name in test_names:
        code = resolve_category(name)
        print(f"  - '{name}' -> {code if code else 'UNMAPPED (will use rolling average fallback)'}")

    # 2. Test live database forecast
    print("\n[Step 2] Executing Forecaster against Database:")
    with SessionLocal() as db:
        restaurant = db.scalar(select(Restaurant).order_by(Restaurant.created_at).limit(1))
        if not restaurant:
            print("  [ERROR] No restaurant found in database.")
            return

        branch = db.scalar(
            select(Branch)
            .where(Branch.restaurant_id == restaurant.id, Branch.is_active.is_(True))
            .order_by(Branch.created_at)
            .limit(1)
        )
        if not branch:
            print("  [ERROR] No active branch found in database.")
            return

        print(f"  Running for Restaurant: '{restaurant.name}' | Branch: '{branch.address}' ({branch.id})")
        alerts = generate_reorder_alerts(db, branch.id, restaurant.id, horizon_days=30)
        print(f"  Successfully generated {len(alerts)} alerts.\n")

        print("-" * 105)
        print(f"{'Ingredient':<18} | {'Stock':<8} | {'Safety':<8} | {'Category':<8} | {'Avg/Day':<8} | {'Breach':<8} | {'Order By':<12} | {'Urgency':<8}")
        print("-" * 105)
        for a in alerts:
            cat = a.get("category_code") or "Fallback"
            avg = f"{a['avg_daily_usage']:.2f}" if a["avg_daily_usage"] is not None else "N/A"
            breach = f"{a['days_until_safety_breach']}d" if a["days_until_safety_breach"] is not None else "OK"
            order_by = a.get("order_by_date") or "-"
            urgency = a["urgency"].upper()
            stock = f"{a['current_stock']} {a['unit']}"
            safety = f"{a['safety_stock']}"
            print(f"{a['ingredient_name']:<18} | {stock:<8} | {safety:<8} | {cat:<8} | {avg:<8} | {breach:<8} | {order_by:<12} | {urgency:<8}")
        print("-" * 105)


if __name__ == "__main__":
    run_verification()
