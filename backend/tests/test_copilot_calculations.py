import os
from decimal import Decimal

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")

from app.services.copilot import break_even_analysis, price_simulation


def test_price_simulation_uses_recipe_cost_and_explicit_volume_assumption():
    result = price_simulation(
        current_price=Decimal("180"),
        unit_cost=Decimal("100"),
        quantity=100,
        price_change=Decimal("20"),
        quantity_change_percent=Decimal("-10"),
    )

    assert result["expected_quantity"] == 90.0
    assert result["current_gross_profit"] == 8000.0
    assert result["expected_gross_profit"] == 9000.0
    assert result["gross_profit_change"] == 1000.0


def test_break_even_reports_the_maximum_sales_decline():
    result = break_even_analysis(
        current_price=Decimal("180"),
        unit_cost=Decimal("100"),
        quantity=100,
        price_change=Decimal("20"),
    )

    assert result["break_even_quantity"] == 80.0
    assert result["maximum_units_lost"] == 20.0
    assert result["maximum_quantity_loss_percent"] == 20.0


def test_sales_trends_compare_complete_local_days(session_factory):
    from datetime import datetime, time, timedelta, timezone

    from app.models import Branch, Order, Restaurant
    from app.services.copilot import CopilotService
    from app.services.reporting import business_tz, local_today

    with session_factory() as db:
        restaurant = Restaurant(name="R")
        db.add(restaurant)
        db.flush()
        branch = Branch(restaurant_id=restaurant.id, address="A", is_active=True, supports_dine_in=True, supports_takeaway=True, supports_delivery=True)
        db.add(branch)
        db.flush()
        today = local_today()
        # One order at 00:30 local time on each of the last 14 days, plus one today (in progress).
        for back in range(0, 15):
            moment = datetime.combine(today - timedelta(days=back), time(0, 30), tzinfo=business_tz()).astimezone(timezone.utc)
            db.add(Order(restaurant_id=restaurant.id, branch_id=branch.id, order_source="POS", order_type="DINE_IN",
                         status="COMPLETED", total_amount=Decimal("200" if back <= 7 else "100"), ordered_at=moment))
        db.commit()
        result = CopilotService(db, restaurant.id, None).sales_trends(7)

    assert result["current"]["completed_orders"] == 7 and result["current"]["revenue"] == 1400.0
    assert result["previous"]["completed_orders"] == 7 and result["previous"]["revenue"] == 700.0
    assert result["revenue_change_percent"] == 100.0
