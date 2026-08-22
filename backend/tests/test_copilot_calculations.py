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
