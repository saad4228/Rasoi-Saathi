"""
XGBoost-based ingredient usage forecaster.

Ported from the standalone `xgboost_based_inventory_prediction/` prototype
into the main backend. Uses the production PostgreSQL database (via
SQLAlchemy) instead of Excel/CSV files.

The trained model (model.json) and ingredient-category list
(ingredient_categories.json) are loaded on demand and cached.
"""

from __future__ import annotations

import json
import logging
from datetime import date, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID

import numpy as np
import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.inventory_item import InventoryItem
from app.models.menu_item_ingredient import MenuItemIngredient
from app.models.order import Order
from app.models.order_item import OrderItem

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Model + Category List Configuration
# ──────────────────────────────────────────────

_ML_DIR = Path(__file__).resolve().parent
_MODEL_PATH = _ML_DIR / "model.json"
_CATEGORIES_PATH = _ML_DIR / "ingredient_categories.json"

_model = None
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
FORECAST_DAYS = 45
PAR_LEVEL_DAYS_DEFAULT = 14
SHELF_LIFE_SAFETY_MARGIN = 0.7

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


def _load_model():
    """Lazy-load the XGBoost model and canonical categories."""
    global _model, _ingredient_ids  # noqa: PLW0603
    if _model is not None:
        return
    if not _MODEL_PATH.exists():
        raise RuntimeError(f"XGBoost model file not found at {_MODEL_PATH}.")
    from xgboost import XGBRegressor

    _model = XGBRegressor()
    _model.load_model(str(_MODEL_PATH))
    if _CATEGORIES_PATH.exists():
        with open(_CATEGORIES_PATH) as f:
            _ingredient_ids = json.load(f)
    else:
        _ingredient_ids = [f"I_{i:03d}" for i in range(1, 35)]
    logger.info("XGBoost model loaded successfully (%d ingredient categories)", len(_ingredient_ids))


def resolve_category(ingredient_name: str) -> str | None:
    """Resolve an ingredient name or alias to the model's categorical ID."""
    clean = ingredient_name.strip().lower()
    return INGREDIENT_NAME_TO_CATEGORY.get(clean)


# ──────────────────────────────────────────────
# Step 1: Build daily ingredient usage from DB
# ──────────────────────────────────────────────

def _build_daily_usage(
    db: Session,
    branch_id: UUID,
    restaurant_id: UUID,
    lookback_days: int = 90,
) -> pd.DataFrame:
    """
    Query completed orders for the given branch over the last N days,
    join with recipes (menu_item_ingredients), and compute daily
    ingredient usage in kg/litres.
    """
    cutoff = date.today() - timedelta(days=lookback_days)

    rows = db.execute(
        select(
            func.date(Order.ordered_at).label("order_date"),
            MenuItemIngredient.inventory_item_id,
            func.sum(OrderItem.quantity * MenuItemIngredient.quantity_per_unit).label("usage"),
        )
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(
            MenuItemIngredient,
            MenuItemIngredient.menu_item_id == OrderItem.menu_item_id,
        )
        .where(
            Order.branch_id == branch_id,
            Order.restaurant_id == restaurant_id,
            Order.status == "COMPLETED",
            func.date(Order.ordered_at) >= cutoff,
        )
        .group_by(func.date(Order.ordered_at), MenuItemIngredient.inventory_item_id)
        .order_by(func.date(Order.ordered_at))
    ).all()

    if not rows:
        return pd.DataFrame(columns=["Date", "inventory_item_id", "quantity_used"])

    records = [
        {
            "Date": pd.Timestamp(r.order_date),
            "inventory_item_id": str(r.inventory_item_id),
            "quantity_used": float(r.usage),
        }
        for r in rows
    ]

    return pd.DataFrame(records)


# ──────────────────────────────────────────────
# Step 2: Feature engineering
# ──────────────────────────────────────────────

def _engineer_features(daily_usage: pd.DataFrame) -> pd.DataFrame:
    if daily_usage.empty:
        return daily_usage

    df = daily_usage.sort_values(["inventory_item_id", "Date"]).copy()

    df["day_of_week"] = df["Date"].dt.dayofweek
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)
    df["month"] = df["Date"].dt.month
    df["day_of_month"] = df["Date"].dt.day

    grp = df.groupby("inventory_item_id")["quantity_used"]
    df["lag_1"] = grp.shift(1)
    df["lag_7"] = grp.shift(7)
    df["rolling_7_avg"] = grp.transform(
        lambda s: s.shift(1).rolling(window=7, min_periods=1).mean()
    )
    df["rolling_30_avg"] = grp.transform(
        lambda s: s.shift(1).rolling(window=30, min_periods=1).mean()
    )

    return df.reset_index(drop=True)


# ──────────────────────────────────────────────
# Step 3: Recursive multi-day forecast
# ──────────────────────────────────────────────

def _forecast_ingredient(
    category_id: str,
    ing_hist: pd.DataFrame,
    horizon: int = FORECAST_DAYS,
) -> pd.DataFrame:
    """Recursively forecast `horizon` days of usage using the trained XGBoost model."""
    _load_model()
    if ing_hist.empty:
        return pd.DataFrame(columns=["Date", "predicted_usage"])

    sorted_hist = ing_hist.sort_values("Date")
    usage_series = list(sorted_hist["quantity_used"].values)
    last_date = sorted_hist["Date"].max()

    forecasts = []
    for step in range(1, horizon + 1):
        future_date = last_date + pd.Timedelta(days=step)

        lag_1 = usage_series[-1]
        lag_7 = usage_series[-7] if len(usage_series) >= 7 else np.nan
        rolling_7 = float(np.mean(usage_series[-7:]))
        rolling_30 = float(np.mean(usage_series[-30:]))

        row = pd.DataFrame([{
            "Ingredient_ID": pd.Categorical([category_id], categories=_ingredient_ids)[0],
            "day_of_week": future_date.dayofweek,
            "is_weekend": int(future_date.dayofweek in (5, 6)),
            "month": future_date.month,
            "day_of_month": future_date.day,
            "lag_1": lag_1,
            "lag_7": lag_7,
            "rolling_7_avg": rolling_7,
            "rolling_30_avg": rolling_30,
        }])
        row["Ingredient_ID"] = row["Ingredient_ID"].astype(
            pd.CategoricalDtype(categories=_ingredient_ids)
        )

        pred = float(_model.predict(row[FEATURE_COLS])[0])
        pred = max(0.0, pred)

        usage_series.append(pred)
        forecasts.append({"Date": future_date, "predicted_usage": pred})

    return pd.DataFrame(forecasts)


# ──────────────────────────────────────────────
# Step 4: Par-level reorder calculation
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
    recommended_qty = max(0.0, par_level_qty - projected_stock_on_arrival)

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
    Run the XGBoost prediction and inventory reorder pipeline for a branch:
    1. Extract historical recipe consumption from completed orders
    2. Engineer time-series lag and rolling average features
    3. Resolve DB inventory names to trained XGBoost categories
    4. Execute recursive multi-step forecasting (or fallback to rolling average)
    5. Calculate safety breach dates, order-by deadlines, and par-level recommended restock quantities.
    """
    try:
        _load_model()
    except Exception as e:
        logger.warning("Could not pre-load XGBoost model: %s", e)

    inv_items = db.execute(
        select(InventoryItem).where(InventoryItem.branch_id == branch_id)
    ).scalars().all()

    if not inv_items:
        return []

    daily_usage = _build_daily_usage(db, branch_id, restaurant_id)
    featured = _engineer_features(daily_usage) if not daily_usage.empty else pd.DataFrame()

    alerts: list[dict[str, Any]] = []

    for item in inv_items:
        ing_id_str = str(item.id)
        ing_name = item.name
        current_stock = float(item.current_stock)
        safety_level = float(item.safety_stock_level)
        lead_time = item.reorder_delay_days or 0
        shelf_life = item.shelf_life_days or 365

        # Get historical usage for this specific inventory item
        ing_history = (
            featured[featured["inventory_item_id"] == ing_id_str]
            if not featured.empty
            else pd.DataFrame()
        )

        cat_id = resolve_category(ing_name)

        fc = pd.DataFrame()
        if not ing_history.empty and cat_id and _model is not None and cat_id in _ingredient_ids:
            # Use XGBoost model
            try:
                fc = _forecast_ingredient(cat_id, ing_history, horizon_days)
            except Exception as ex:
                logger.warning("XGBoost prediction failed for %s (%s): %s", ing_name, cat_id, ex)

        if fc.empty and not ing_history.empty:
            # Fallback to rolling 7-day average projection
            recent_avg = float(ing_history["quantity_used"].tail(7).mean())
            if np.isnan(recent_avg) or recent_avg <= 0:
                recent_avg = float(ing_history["quantity_used"].mean())
            recent_avg = max(0.01, recent_avg if not np.isnan(recent_avg) else 0.1)

            last_dt = ing_history["Date"].max()
            fc = pd.DataFrame({
                "Date": [last_dt + pd.Timedelta(days=d) for d in range(1, horizon_days + 1)],
                "predicted_usage": [recent_avg] * horizon_days,
            })

        if fc.empty:
            # No sales history for this ingredient: static inventory analysis
            if current_stock <= 0:
                urgency = "critical"
                status_text = "OUT OF STOCK — reorder immediately"
            elif current_stock <= safety_level:
                urgency = "critical"
                status_text = f"Below safety stock ({safety_level} {item.unit})"
            else:
                urgency = "ok"
                status_text = "Stock adequate — awaiting sales history"

            alerts.append({
                "id": str(item.id),
                "ingredient_name": ing_name,
                "category_code": cat_id,
                "current_stock": current_stock,
                "unit": item.unit,
                "safety_stock": safety_level,
                "shelf_life_days": shelf_life,
                "reorder_delay_days": lead_time,
                "avg_daily_usage": None,
                "days_until_safety_breach": 0 if current_stock <= safety_level else None,
                "order_by_date": str(date.today()) if current_stock <= safety_level else None,
                "par_coverage_days": PAR_LEVEL_DAYS_DEFAULT,
                "recommended_order_qty": max(0.0, safety_level * 2 - current_stock) if current_stock <= safety_level else 0.0,
                "urgency": urgency,
                "status": status_text,
            })
            continue

        # Compute stock depletion curve
        fc = fc.copy()
        fc["cumulative_usage"] = fc["predicted_usage"].cumsum()
        fc["projected_stock"] = current_stock - fc["cumulative_usage"]

        avg_daily = round(float(fc["predicted_usage"].mean()), 3)
        forecast_start = fc["Date"].min()

        breach = fc[fc["projected_stock"] <= safety_level]
        if breach.empty:
            days_to_breach = None
            order_by = None
            urgency = "ok"
            status_text = f"Stock lasts {horizon_days}+ days"
            par_days, rec_qty = PAR_LEVEL_DAYS_DEFAULT, 0.0
        else:
            first_breach = breach.iloc[0]
            days_to_breach = (first_breach["Date"] - forecast_start).days + 1
            order_by_dt = first_breach["Date"] - pd.Timedelta(days=lead_time)
            order_by = str(order_by_dt.date())

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
            "id": str(item.id),
            "ingredient_name": ing_name,
            "category_code": cat_id,
            "current_stock": current_stock,
            "unit": item.unit,
            "safety_stock": safety_level,
            "shelf_life_days": shelf_life,
            "reorder_delay_days": lead_time,
            "avg_daily_usage": avg_daily,
            "days_until_safety_breach": days_to_breach,
            "order_by_date": order_by,
            "par_coverage_days": par_days,
            "recommended_order_qty": rec_qty,
            "urgency": urgency,
            "status": status_text,
        })

    # Sort alerts: critical first (0), warning (1), ok (2), then by days_until_safety_breach ascending
    urgency_order = {"critical": 0, "warning": 1, "ok": 2}
    alerts.sort(
        key=lambda a: (
            urgency_order.get(a["urgency"], 3),
            a["days_until_safety_breach"] if a["days_until_safety_breach"] is not None else 9999,
        )
    )

    return alerts
