from datetime import datetime, time, timedelta, timezone
from decimal import Decimal

import pytest

pytest.importorskip("pandas")
pytest.importorskip("xgboost")

from app.ml import forecaster  # noqa: E402
from app.models import Branch, InventoryItem, MenuItem, MenuItemIngredient, Order, OrderItem, Restaurant  # noqa: E402
from app.services.reporting import business_tz, local_today  # noqa: E402

DAYS = 28


@pytest.fixture()
def kitchen(session_factory):
    """28 days of history: rice every day (3.3 kg), cardamom on weekends only, and a dish at another branch."""
    with session_factory() as db:
        restaurant = Restaurant(name="R")
        db.add(restaurant)
        db.flush()
        kwargs = dict(restaurant_id=restaurant.id, is_active=True, supports_dine_in=True, supports_takeaway=True, supports_delivery=True)
        branch, other_branch = Branch(address="Central", **kwargs), Branch(address="Riverside", **kwargs)
        db.add_all([branch, other_branch])
        db.flush()
        rice = InventoryItem(branch_id=branch.id, name="Basmati Rice", unit="kg", current_stock=Decimal("40"), safety_stock_level=Decimal("10"), reorder_delay_days=2, cost_per_unit=Decimal("92"))
        cardamom = InventoryItem(branch_id=branch.id, name="Cardamom", unit="kg", current_stock=Decimal("1"), safety_stock_level=Decimal("0.2"), reorder_delay_days=5, cost_per_unit=Decimal("1400"))
        tea = InventoryItem(branch_id=branch.id, name="Tea Leaves", unit="kg", current_stock=Decimal("3"), safety_stock_level=Decimal("1"), cost_per_unit=Decimal("520"))
        other_rice = InventoryItem(branch_id=other_branch.id, name="Basmati Rice", unit="kg", current_stock=Decimal("40"), safety_stock_level=Decimal("10"), cost_per_unit=Decimal("92"))
        db.add_all([rice, cardamom, tea, other_rice])
        db.flush()
        biryani = MenuItem(restaurant_id=restaurant.id, name="Chicken Biryani", price=Decimal("260"), is_active=True)
        chai = MenuItem(restaurant_id=restaurant.id, name="Masala Chai", price=Decimal("59"), is_active=True)
        db.add_all([biryani, chai])
        db.flush()
        db.add_all([
            MenuItemIngredient(menu_item_id=biryani.id, inventory_item_id=rice.id, quantity_per_unit=Decimal("0.22")),
            MenuItemIngredient(menu_item_id=biryani.id, inventory_item_id=other_rice.id, quantity_per_unit=Decimal("0.22")),
            MenuItemIngredient(menu_item_id=chai.id, inventory_item_id=cardamom.id, quantity_per_unit=Decimal("0.01")),
            MenuItemIngredient(menu_item_id=chai.id, inventory_item_id=tea.id, quantity_per_unit=Decimal("0.006")),
        ])
        today = local_today()
        for back in range(DAYS, -1, -1):  # includes today, which must be ignored as a partial day
            day = today - timedelta(days=back)
            order = Order(restaurant_id=restaurant.id, branch_id=branch.id, order_source="POS", order_type="DINE_IN", status="COMPLETED",
                          total_amount=Decimal("0"), ordered_at=datetime.combine(day, time(13, 0), tzinfo=business_tz()).astimezone(timezone.utc))
            db.add(order)
            db.flush()
            db.add(OrderItem(order_id=order.id, menu_item_id=biryani.id, quantity=15 if back else 1, unit_price=Decimal("260"), total_price=Decimal("0")))
            if day.weekday() in (5, 6):
                db.add(OrderItem(order_id=order.id, menu_item_id=chai.id, quantity=10, unit_price=Decimal("59"), total_price=Decimal("0")))
        db.commit()
        return {"branch": branch.id, "restaurant": restaurant.id}


def alerts_by_name(session_factory, kitchen):
    with session_factory() as db:
        alerts = forecaster.generate_reorder_alerts(db, kitchen["branch"], kitchen["restaurant"], horizon_days=28)
    return {alert["ingredient_name"]: alert for alert in alerts}


def test_daily_usage_is_zero_filled_calendar_days_excluding_today(session_factory, kitchen):
    with session_factory() as db:
        usage = forecaster._build_daily_usage(db, kitchen["branch"], kitchen["restaurant"])
    per_item = usage.groupby("inventory_item_id")["quantity_used"]
    assert usage["Date"].max().date() == local_today() - timedelta(days=1)
    assert sorted(round(v, 3) for v in per_item.max()) == [0.06, 0.1, 3.3]
    assert (usage["quantity_used"] == 0).any()  # weekday gaps for cardamom/tea are explicit zeros


def test_forecasts_match_this_restaurants_scale(session_factory, kitchen):
    alerts = alerts_by_name(session_factory, kitchen)
    rice = alerts["Basmati Rice"]
    assert rice["method"] == "xgboost_calibrated"
    assert rice["avg_daily_usage"] == pytest.approx(3.3, rel=0.05)

    cardamom = alerts["Cardamom"]  # used 2 days a week: 0.1 kg x 2 / 7
    assert cardamom["avg_daily_usage"] == pytest.approx(0.1 * 2 / 7, rel=0.25)


def test_unmapped_ingredients_say_they_use_the_moving_average(session_factory, kitchen):
    tea = alerts_by_name(session_factory, kitchen)["Tea Leaves"]
    assert tea["method"] == "moving_average"
    assert tea["method_label"].startswith("Average")


def test_calibration_keeps_shape_and_matches_level():
    import pandas as pd

    raw = pd.DataFrame({"Date": pd.date_range("2026-01-01", periods=4), "predicted_usage": [8.0, 12.0, 8.0, 12.0]})
    calibrated = forecaster.calibrate_to_recent_usage(raw, recent_average=2.0)
    assert list(calibrated["predicted_usage"]) == pytest.approx([1.6, 2.4, 1.6, 2.4])


def test_dish_demand_forecast_uses_same_weekday_history(session_factory, kitchen):
    with session_factory() as db:
        forecast = forecaster.forecast_dish_demand(db, kitchen["restaurant"], kitchen["branch"], days=7)
    biryani = [row for row in forecast if row["dish"] == "Chicken Biryani"]
    assert len(biryani) == 7 and all(row["predicted_quantity"] == 15 for row in biryani)
    chai = {row["date"]: row["predicted_quantity"] for row in forecast if row["dish"] == "Masala Chai"}
    weekend = [q for d, q in chai.items() if datetime.fromisoformat(d).weekday() in (5, 6)]
    weekday = [q for d, q in chai.items() if datetime.fromisoformat(d).weekday() < 5]
    assert all(q == 10 for q in weekend) and all(q == 0 for q in weekday)
