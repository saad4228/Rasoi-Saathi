"""
Ingredient usage forecaster and reorder planner.

Daily ingredient usage is rebuilt from completed orders and this branch's
recipes, then projected forward:

* ``xgboost_calibrated`` - the bundled XGBoost model (trained on another
  restaurant's data, see model.json) supplies the day-to-day *shape* of demand,
  and the projection is rescaled so its average matches this branch's own
  recent average usage. Uncalibrated, the model forecasts its training
  restaurant's volumes rather than yours.
* ``moving_average`` - recent average daily usage, used when the ingredient
  name is not one of the model's 34 categories or the model is unavailable.
* ``no_history`` - no usage recorded yet; only stock vs safety level is checked.
"""

from __future__ import annotations

import json
import logging
import threading
from datetime import date, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inventory_item import InventoryItem
from app.models.menu_item import MenuItem
from app.models.menu_item_ingredient import MenuItemIngredient
from app.models.order import Order
from app.models.order_item import OrderItem
from app.services.reporting import day_start_utc, local_date, local_today

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Model + Category List Configuration
# ──────────────────────────────────────────────

_ML_DIR = Path(__file__).resolve().parent
_MODEL_PATH = _ML_DIR / "model.json"
_CATEGORIES_PATH = _ML_DIR / "ingredient_categories.json"

_model = None
_model_error: str | None = None
_model_lock = threading.Lock()
_ingredient_ids: list[str] = []

FEATURE_COLS = [
    "Ingredient_ID",
    "day_of_week",
    "is_weekend",
    "month",
    "day_of_month",
    "lag_1",
    "lag_7",
    "rolling_7_avg",
    "rolling_30_avg",
]
FORECAST_DAYS = 30
LOOKBACK_DAYS = 90
CALIBRATION_WINDOW_DAYS = 28
PAR_LEVEL_DAYS_DEFAULT = 14
SHELF_LIFE_SAFETY_MARGIN = 0.7

METHOD_LABELS = {
    "xgboost_calibrated": "XGBoost pattern, scaled to your recent usage",
    "moving_average": "Average of your recent daily usage",
    "no_history": "No usage recorded yet",
}

# Canonical mapping from human-readable names / aliases in DB to the 34 trained XGBoost categories
INGREDIENT_NAME_TO_CATEGORY: dict[str, str] = {
    # I_001 Rice
    "rice": "I_001",
    "basmati rice": "I_001",
    "raw rice": "I_001",
    "chawal": "I_001",
    # I_002 Black pepper
    "black pepper": "I_002",
    "pepper": "I_002",
    "kali mirch": "I_002",
    # I_003 Butter
    "butter": "I_003",
    "makhan": "I_003",
    # I_004 Capsicum
    "capsicum": "I_004",
    "shimla mirch": "I_004",
    "bell pepper": "I_004",
    # I_005 Cardamom
    "cardamom": "I_005",
    "elaichi": "I_005",
    "green cardamom": "I_005",
    # I_006 Cashew
    "cashew": "I_006",
    "cashews": "I_006",
    "kaju": "I_006",
    # I_007 Chicken
    "chicken": "I_007",
    "raw chicken": "I_007",
    "chicken breast": "I_007",
    "murgh": "I_007",
    # I_008 Coriander
    "coriander": "I_008",
    "fresh coriander": "I_008",
    "coriander leaves": "I_008",
    "dhaniya": "I_008",
    "cilantro": "I_008",
    # I_009 Coriander powder
    "coriander powder": "I_009",
    "dhaniya powder": "I_009",
    # I_010 Cream
    "cream": "I_010",
    "fresh cream": "I_010",
    "malai": "I_010",
    # I_011 Cumin
    "cumin": "I_011",
    "jeera": "I_011",
    "cumin seeds": "I_011",
    # I_012 Garam masala
    "garam masala": "I_012",
    "masala": "I_012",
    # I_013 Garlic
    "garlic": "I_013",
    "lehsun": "I_013",
    # I_014 Ginger
    "ginger": "I_014",
    "adrak": "I_014",
    # I_015 Green chilli
    "green chilli": "I_015",
    "green chili": "I_015",
    "hari mirch": "I_015",
    # I_016 Kasuri methi
    "kasuri methi": "I_016",
    "fenugreek leaves": "I_016",
    # I_017 Maida
    "maida": "I_017",
    "all purpose flour": "I_017",
    # I_018 Milk
    "milk": "I_018",
    "doodh": "I_018",
    # I_019 Oil/Ghee
    "oil": "I_019",
    "cooking oil": "I_019",
    "ghee": "I_019",
    "mustard oil": "I_019",
    "refined oil": "I_019",
    "sunflower oil": "I_019",
    "oil/ghee": "I_019",
    # I_020 Onion
    "onion": "I_020",
    "onions": "I_020",
    "pyaz": "I_020",
    # I_021 Potato
    "potato": "I_021",
    "potatoes": "I_021",
    "aloo": "I_021",
    # I_022 Red chilli
    "red chilli": "I_022",
    "red chili": "I_022",
    "lal mirch": "I_022",
    "chilli powder": "I_022",
    # I_023 Saffron
    "saffron": "I_023",
    "kesar": "I_023",
    # I_024 Salt
    "salt": "I_024",
    "namak": "I_024",
    # I_025 Sugar
    "sugar": "I_025",
    "cheeni": "I_025",
    # I_026 Tomato
    "tomato": "I_026",
    "tomatoes": "I_026",
    "tamatar": "I_026",
    # I_027 Turmeric
    "turmeric": "I_027",
    "haldi": "I_027",
    # I_028 Wheat flour
    "wheat flour": "I_028",
    "atta": "I_028",
    "gram flour": "I_028",
    "besan": "I_028",
    # I_029 Yogurt
    "yogurt": "I_029",
    "curd": "I_029",
    "dahi": "I_029",
    # I_030 Paneer
    "paneer": "I_030",
    "cottage cheese": "I_030",
    # I_031 Rajma
    "rajma": "I_031",
    "kidney beans": "I_031",
    # I_032 Tur Dal
    "tur dal": "I_032",
    "toor dal": "I_032",
    "arhar dal": "I_032",
    "lentils": "I_032",
    "dal": "I_032",
    "yellow lentils": "I_032",
    # I_033 Urad Dal
    "urad dal": "I_033",
    "black gram": "I_033",
    # I_034 Brinjal
    "brinjal": "I_034",
    "eggplant": "I_034",
    "baingan": "I_034",
}


def _load_model() -> None:
    """Lazy-load the XGBoost model once; remember a failure instead of retrying every request."""
    global _model, _model_error, _ingredient_ids  # noqa: PLW0603
    if _model is not None or _model_error is not None:
        return
    with _model_lock:
        if _model is not None or _model_error is not None:
            return
        try:
            if not _MODEL_PATH.exists():
                raise RuntimeError(f"XGBoost model file not found at {_MODEL_PATH}.")
            from xgboost import XGBRegressor

            model = XGBRegressor()
            model.load_model(str(_MODEL_PATH))
            if _CATEGORIES_PATH.exists():
                with open(_CATEGORIES_PATH, encoding="utf-8") as f:
                    _ingredient_ids = json.load(f)
            else:
                _ingredient_ids = [f"I_{i:03d}" for i in range(1, 35)]
            _model = model
            logger.info("XGBoost model loaded (%d ingredient categories)", len(_ingredient_ids))
        except Exception as exc:  # noqa: BLE001 - forecasting still works with the moving-average method
            _model_error = str(exc)
            logger.warning("XGBoost model unavailable, using moving averages instead: %s", exc)


def resolve_category(ingredient_name: str) -> str | None:
    """Resolve an ingredient name or alias to the model's categorical ID."""
    return INGREDIENT_NAME_TO_CATEGORY.get(ingredient_name.strip().lower())


# ──────────────────────────────────────────────
# Step 1: Daily ingredient usage from completed orders
# ──────────────────────────────────────────────

def _build_daily_usage(
    db: Session,
    branch_id: UUID,
    restaurant_id: UUID,
    lookback_days: int = LOOKBACK_DAYS,
) -> pd.DataFrame:
    """
    One row per (ingredient, calendar day) from the ingredient's first recorded
    use through yesterday, in the business timezone. Days without sales are 0,
    so averages and lags are over calendar days rather than sales days. Today is
    excluded because it is still in progress.
    """
    today = local_today()
    start_day = today - timedelta(days=lookback_days)

    rows = db.execute(
        select(
            Order.ordered_at,
            MenuItemIngredient.inventory_item_id,
            OrderItem.quantity * MenuItemIngredient.quantity_per_unit,
        )
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(MenuItemIngredient, MenuItemIngredient.menu_item_id == OrderItem.menu_item_id)
        .join(InventoryItem, InventoryItem.id == MenuItemIngredient.inventory_item_id)
        .where(
            Order.branch_id == branch_id,
            Order.restaurant_id == restaurant_id,
            Order.status == "COMPLETED",
            Order.ordered_at >= day_start_utc(start_day),
            Order.ordered_at < day_start_utc(today),
            # Only this branch's recipe lines: a dish's other branches use other stock.
            InventoryItem.branch_id == branch_id,
        )
    ).all()

    if not rows:
        return pd.DataFrame(columns=["Date", "inventory_item_id", "quantity_used"])

    raw = pd.DataFrame(
        {
            "Date": [pd.Timestamp(local_date(ordered_at)) for ordered_at, _, _ in rows],
            "inventory_item_id": [str(item_id) for _, item_id, _ in rows],
            "quantity_used": [float(usage) for _, _, usage in rows],
        }
    )
    daily = raw.groupby(["inventory_item_id", "Date"], as_index=False)["quantity_used"].sum()

    yesterday = pd.Timestamp(today - timedelta(days=1))
    filled = []
    for item_id, group in daily.groupby("inventory_item_id"):
        calendar = pd.date_range(group["Date"].min(), yesterday, freq="D")
        series = group.set_index("Date")["quantity_used"].reindex(calendar, fill_value=0.0)
        filled.append(pd.DataFrame({"Date": calendar, "inventory_item_id": item_id, "quantity_used": series.to_numpy()}))
    return pd.concat(filled, ignore_index=True)


# ──────────────────────────────────────────────
# Step 2: Forecasting
# ──────────────────────────────────────────────

def _recent_average(history: pd.DataFrame) -> float:
    return float(history.sort_values("Date")["quantity_used"].tail(CALIBRATION_WINDOW_DAYS).mean())


def _forecast_ingredient(
    category_id: str,
    ing_hist: pd.DataFrame,
    horizon: int = FORECAST_DAYS,
    start: date | None = None,
) -> pd.DataFrame:
    """Recursively forecast `horizon` days starting at `start` (default: today) with the raw XGBoost model."""
    _load_model()
    if _model is None:
        raise RuntimeError(_model_error or "XGBoost model is not available")
    if ing_hist.empty:
        return pd.DataFrame(columns=["Date", "predicted_usage"])

    sorted_hist = ing_hist.sort_values("Date")
    usage_series = [float(value) for value in sorted_hist["quantity_used"].to_numpy()]
    first_day = pd.Timestamp(start or local_today())

    rows = []
    for step in range(horizon):
        future_date = first_day + pd.Timedelta(days=step)
        row = pd.DataFrame([{
            "Ingredient_ID": category_id,
            "day_of_week": future_date.dayofweek,
            "is_weekend": int(future_date.dayofweek in (5, 6)),
            "month": future_date.month,
            "day_of_month": future_date.day,
            "lag_1": usage_series[-1],
            "lag_7": usage_series[-7] if len(usage_series) >= 7 else np.nan,
            "rolling_7_avg": float(np.mean(usage_series[-7:])),
            "rolling_30_avg": float(np.mean(usage_series[-30:])),
        }])
        row["Ingredient_ID"] = row["Ingredient_ID"].astype(pd.CategoricalDtype(categories=_ingredient_ids))

        pred = max(0.0, float(_model.predict(row[FEATURE_COLS])[0]))
        usage_series.append(pred)
        rows.append({"Date": future_date, "predicted_usage": pred})

    return pd.DataFrame(rows)


def calibrate_to_recent_usage(raw_forecast: pd.DataFrame, recent_average: float) -> pd.DataFrame:
    """Keep the model's day-to-day pattern but match this branch's recent average usage."""
    calibrated = raw_forecast.copy()
    raw_mean = float(calibrated["predicted_usage"].mean()) if not calibrated.empty else 0.0
    scale = recent_average / raw_mean if raw_mean > 0 else 0.0
    calibrated["predicted_usage"] = calibrated["predicted_usage"] * scale
    return calibrated


def forecast_usage(item_name: str, history: pd.DataFrame, horizon: int, start: date | None = None) -> tuple[pd.DataFrame, str]:
    """Return (daily forecast, method) for one ingredient."""
    first_day = pd.Timestamp(start or local_today())
    recent_average = _recent_average(history)

    category = resolve_category(item_name)
    if category is not None:
        _load_model()
        if _model is not None and category in _ingredient_ids:
            try:
                raw = _forecast_ingredient(category, history, horizon, start)
                return calibrate_to_recent_usage(raw, recent_average), "xgboost_calibrated"
            except Exception:  # noqa: BLE001
                logger.warning("XGBoost prediction failed for %s; using moving average", item_name, exc_info=True)

    dates = [first_day + pd.Timedelta(days=offset) for offset in range(horizon)]
    return pd.DataFrame({"Date": dates, "predicted_usage": [recent_average] * horizon}), "moving_average"


# ──────────────────────────────────────────────
# Step 3: Par-level reorder calculation
# ──────────────────────────────────────────────

def _compute_par_level_order(
    fc: pd.DataFrame,
    current_stock: float,
    safety_level: float,
    lead_time: int,
    shelf_life: int,
    order_by_date,
    forecast_start,
    par_level_days: int = PAR_LEVEL_DAYS_DEFAULT,
    shelf_life_margin: float = SHELF_LIFE_SAFETY_MARGIN,
) -> tuple[float, float]:
    effective_shelf = shelf_life if shelf_life and shelf_life > 0 else 365
    par_days = min(par_level_days, effective_shelf * shelf_life_margin)

    order_placement_date = (
        max(forecast_start, order_by_date) if order_by_date is not None else forecast_start
    )
    arrival_date = order_placement_date + pd.Timedelta(days=lead_time)

    at_or_after_arrival = fc[fc["Date"] >= arrival_date]
    if not at_or_after_arrival.empty:
        projected_stock_on_arrival = at_or_after_arrival.iloc[0]["projected_stock"]
        arrival_actual_date = at_or_after_arrival.iloc[0]["Date"]
    else:
        projected_stock_on_arrival = fc.iloc[-1]["projected_stock"]
        arrival_actual_date = fc.iloc[-1]["Date"]

    coverage_window = fc[
        (fc["Date"] > arrival_actual_date)
        & (fc["Date"] <= arrival_actual_date + pd.Timedelta(days=par_days))
    ]
    if not coverage_window.empty:
        expected_demand = float(coverage_window["predicted_usage"].sum())
    else:
        expected_demand = float(fc["predicted_usage"].mean() * par_days)

    par_level_qty = safety_level + expected_demand
    recommended_qty = max(0.0, par_level_qty - max(projected_stock_on_arrival, 0.0))

    return round(float(par_days), 1), round(float(recommended_qty), 2)


# ──────────────────────────────────────────────
# Public API: Generate Reorder Alerts
# ──────────────────────────────────────────────

def generate_reorder_alerts(
    db: Session,
    branch_id: UUID,
    restaurant_id: UUID,
    horizon_days: int = FORECAST_DAYS,
) -> list[dict[str, Any]]:
    """
    Forecast each ingredient of a branch and turn the projected stock curve into
    safety-breach dates, order-by deadlines and par-level restock quantities.
    """
    inv_items = db.scalars(
        select(InventoryItem).where(InventoryItem.branch_id == branch_id, InventoryItem.is_active.is_(True))
    ).all()
    if not inv_items:
        return []

    daily_usage = _build_daily_usage(db, branch_id, restaurant_id)
    today = local_today()
    forecast_start = pd.Timestamp(today)

    alerts: list[dict[str, Any]] = []
    for item in inv_items:
        current_stock = float(item.current_stock)
        safety_level = float(item.safety_stock_level)
        lead_time = item.reorder_delay_days or 0
        shelf_life = item.shelf_life_days or 365
        category = resolve_category(item.name)
        base = {
            "id": str(item.id),
            "ingredient_name": item.name,
            "category_code": category,
            "current_stock": current_stock,
            "unit": item.unit,
            "safety_stock": safety_level,
            "shelf_life_days": shelf_life,
            "reorder_delay_days": lead_time,
        }

        history = daily_usage[daily_usage["inventory_item_id"] == str(item.id)] if not daily_usage.empty else daily_usage
        if history.empty or _recent_average(history) <= 0:
            below_safety = current_stock <= safety_level
            if current_stock <= 0:
                urgency, status_text = "critical", "OUT OF STOCK — reorder immediately"
            elif below_safety:
                urgency, status_text = "critical", f"Below safety stock ({safety_level:g} {item.unit})"
            else:
                urgency, status_text = "ok", "Stock adequate — no recent usage recorded"
            alerts.append({
                **base,
                "method": "no_history",
                "method_label": METHOD_LABELS["no_history"],
                "avg_daily_usage": None,
                "days_until_safety_breach": 0 if below_safety else None,
                "order_by_date": str(today) if below_safety else None,
                "par_coverage_days": PAR_LEVEL_DAYS_DEFAULT,
                "recommended_order_qty": round(max(0.0, safety_level * 2 - current_stock), 2) if below_safety else 0.0,
                "urgency": urgency,
                "status": status_text,
            })
            continue

        fc, method = forecast_usage(item.name, history, horizon_days, today)
        fc = fc.copy()
        fc["cumulative_usage"] = fc["predicted_usage"].cumsum()
        fc["projected_stock"] = current_stock - fc["cumulative_usage"]
        avg_daily = round(float(fc["predicted_usage"].mean()), 3)

        breach = fc[fc["projected_stock"] <= safety_level]
        if breach.empty:
            days_to_breach = None
            order_by = None
            urgency = "ok"
            status_text = f"Stock lasts {horizon_days}+ days"
            par_days, rec_qty = PAR_LEVEL_DAYS_DEFAULT, 0.0
        else:
            first_breach = breach.iloc[0]
            days_to_breach = int((first_breach["Date"] - forecast_start).days)
            order_by_dt = first_breach["Date"] - pd.Timedelta(days=lead_time)
            order_by = str(max(order_by_dt, forecast_start).date())

            par_days, rec_qty = _compute_par_level_order(
                fc, current_stock, safety_level, lead_time, shelf_life,
                order_by_dt, forecast_start,
            )

            if order_by_dt <= forecast_start:
                urgency = "critical"
                status_text = "ORDER NOW — lead time already tight or overdue"
            elif days_to_breach <= 3:
                urgency = "critical"
                status_text = f"Order by {order_by} (critical: {days_to_breach} days left)"
            elif days_to_breach <= 7:
                urgency = "warning"
                status_text = f"Order by {order_by} ({days_to_breach} days left)"
            else:
                urgency = "ok"
                status_text = f"Order by {order_by}"

        alerts.append({
            **base,
            "method": method,
            "method_label": METHOD_LABELS[method],
            "avg_daily_usage": avg_daily,
            "days_until_safety_breach": days_to_breach,
            "order_by_date": order_by,
            "par_coverage_days": par_days,
            "recommended_order_qty": rec_qty,
            "urgency": urgency,
            "status": status_text,
        })

    urgency_order = {"critical": 0, "warning": 1, "ok": 2}
    alerts.sort(
        key=lambda a: (
            urgency_order.get(a["urgency"], 3),
            a["days_until_safety_breach"] if a["days_until_safety_breach"] is not None else 9999,
        )
    )
    return alerts


# ──────────────────────────────────────────────
# Dish demand (used by the Copilot)
# ──────────────────────────────────────────────

def forecast_dish_demand(
    db: Session,
    restaurant_id: UUID,
    branch_id: UUID | None,
    days: int = 7,
    window_days: int = CALIBRATION_WINDOW_DAYS,
) -> list[dict[str, Any]]:
    """Estimate dish sales for the next `days` days from same-weekday averages over the last `window_days`."""
    today = local_today()
    window_start = today - timedelta(days=window_days)
    filters = [
        Order.restaurant_id == restaurant_id,
        Order.status == "COMPLETED",
        Order.ordered_at >= day_start_utc(window_start),
        Order.ordered_at < day_start_utc(today),
    ]
    if branch_id is not None:
        filters.append(Order.branch_id == branch_id)
    rows = db.execute(
        select(Order.ordered_at, MenuItem.name, OrderItem.quantity)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(MenuItem, MenuItem.id == OrderItem.menu_item_id)
        .where(*filters)
    ).all()

    weekday_counts = [0] * 7
    for offset in range(window_days):
        weekday_counts[(window_start + timedelta(days=offset)).weekday()] += 1
    totals: dict[str, list[float]] = {}
    for ordered_at, name, quantity in rows:
        totals.setdefault(name, [0.0] * 7)[local_date(ordered_at).weekday()] += quantity

    forecast = []
    for offset in range(days):
        day = today + timedelta(days=offset)
        for name, by_weekday in totals.items():
            occurrences = weekday_counts[day.weekday()]
            forecast.append({
                "dish": name,
                "date": day.isoformat(),
                "predicted_quantity": round(by_weekday[day.weekday()] / occurrences, 1) if occurrences else 0.0,
            })
    return forecast
