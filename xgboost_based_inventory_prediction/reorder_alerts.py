"""
Step 4 of the XGBoost pipeline: forecast ingredient usage forward day-by-day,
project stock depletion, and flag when to place a reorder.

Since forecasting more than 1 day ahead requires lag/rolling features that
don't exist yet for future dates, this forecasts RECURSIVELY: predict day 1,
feed that prediction back in as the lag for day 2, and so on. This is the
standard approach for multi-step time-series forecasting with a
single-step model, but note that errors can compound the further out you
forecast -- treat day-30 forecasts as much rougher than day-1 forecasts.

Input:
    XGBoost_data.xlsx          -- Ingredients sheet (stock, safety level, lead time)
    training_data.csv          -- most recent actual usage, to seed the recursion
    model.json                 -- trained model from train_model.py

Output:
    reorder_alerts.csv         -- one row per ingredient: days until stockout,
                                   recommended order-by date, urgency flag
    forecast_detail.csv        -- full day-by-day forecast per ingredient

Run: python reorder_alerts.py
"""

import json
import pandas as pd
import numpy as np
from xgboost import XGBRegressor

DATA_FILE = "XGBoost_data.xlsx"
TRAINING_DATA = "training_data.csv"
MODEL_FILE = "model.json"
CATEGORIES_FILE = "ingredient_categories.json"
FORECAST_DAYS = 45  # how far ahead to project

# Par-level order-quantity settings. An order brings stock back up to
# `par_level = safety_stock + expected demand over PAR_LEVEL_DAYS`, capped so
# a perishable is never stocked past a safe fraction of its shelf life.
PAR_LEVEL_DAYS_DEFAULT = 14      # target days of coverage for a "full" restock
SHELF_LIFE_SAFETY_MARGIN = 0.7   # never target more than 70% of shelf life on hand

FEATURE_COLS = [
    "Ingredient_ID", "day_of_week", "is_weekend", "month", "day_of_month",
    "lag_1", "lag_7", "rolling_7_avg", "rolling_30_avg",
]


def load_inputs():
    ingredients = pd.read_excel(DATA_FILE, sheet_name="Ingredients")
    history = pd.read_csv(TRAINING_DATA, parse_dates=["Date"])

    # Use the EXACT category list the model was trained on (train_model.py
    # persists this), rather than re-deriving it from the Ingredients sheet
    # here. If the two were ever computed independently and happened to
    # diverge -- e.g. a new ingredient added after training -- XGBoost raises
    # a hard error on the very first prediction and this script produces zero
    # alerts for every ingredient, not just the new one. Loading the same
    # persisted list guarantees train-time and inference-time categories match.
    with open(CATEGORIES_FILE) as f:
        all_ingredient_ids = json.load(f)
    history["Ingredient_ID"] = pd.Categorical(
        history["Ingredient_ID"], categories=all_ingredient_ids
    )

    model = XGBRegressor()
    model.load_model(MODEL_FILE)

    return ingredients, history, model, all_ingredient_ids


def forecast_ingredient(ing_id, hist_df, model, all_ids, horizon=FORECAST_DAYS):
    """Recursively forecast `horizon` days of usage for one ingredient."""
    ing_hist = hist_df[hist_df["Ingredient_ID"] == ing_id].sort_values("Date")
    if ing_hist.empty:
        return pd.DataFrame(columns=["Date", "predicted_usage"])

    # Rolling buffer of actual usage we'll keep extending with predictions
    usage_series = list(ing_hist["quantity_used"].values)
    last_date = ing_hist["Date"].max()

    forecasts = []
    for step in range(1, horizon + 1):
        future_date = last_date + pd.Timedelta(days=step)

        lag_1 = usage_series[-1]
        lag_7 = usage_series[-7] if len(usage_series) >= 7 else np.nan
        rolling_7 = np.mean(usage_series[-7:])
        rolling_30 = np.mean(usage_series[-30:])

        row = pd.DataFrame([{
            "Ingredient_ID": pd.Categorical([ing_id], categories=all_ids)[0],
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
            pd.CategoricalDtype(categories=all_ids)
        )

        pred = model.predict(row[FEATURE_COLS])[0]
        pred = max(0, pred)  # usage can't be negative

        usage_series.append(pred)
        forecasts.append({"Date": future_date, "predicted_usage": pred})

    return pd.DataFrame(forecasts)


def compute_par_level_order(fc, current_stock, safety_level, lead_time,
                             shelf_life, order_by_date, forecast_start,
                             par_level_days=PAR_LEVEL_DAYS_DEFAULT,
                             shelf_life_margin=SHELF_LIFE_SAFETY_MARGIN):
    """How much to order, given a par-level (order-up-to) policy.

    par_level = safety_stock + expected demand over `par_days` days following
    the order's arrival, where `par_days` is capped by the ingredient's shelf
    life so a perishable is never stocked with more than it can use before it
    turns. recommended_qty tops the ingredient up from whatever's projected
    to still be on hand when the order arrives.
    """
    par_days = min(par_level_days, shelf_life * shelf_life_margin)

    order_placement_date = max(forecast_start, order_by_date) if order_by_date is not None else forecast_start
    arrival_date = order_placement_date + pd.Timedelta(days=lead_time)

    at_or_after_arrival = fc[fc["Date"] >= arrival_date]
    if not at_or_after_arrival.empty:
        projected_stock_on_arrival = at_or_after_arrival.iloc[0]["projected_stock"]
        arrival_actual_date = at_or_after_arrival.iloc[0]["Date"]
    else:
        # Arrival lands beyond the forecast horizon -- fall back to the last
        # forecasted point we have.
        projected_stock_on_arrival = fc.iloc[-1]["projected_stock"]
        arrival_actual_date = fc.iloc[-1]["Date"]

    coverage_window = fc[
        (fc["Date"] > arrival_actual_date)
        & (fc["Date"] <= arrival_actual_date + pd.Timedelta(days=par_days))
    ]
    if not coverage_window.empty:
        expected_demand = coverage_window["predicted_usage"].sum()
    else:
        expected_demand = fc["predicted_usage"].mean() * par_days

    par_level_qty = safety_level + expected_demand
    recommended_qty = max(0.0, par_level_qty - projected_stock_on_arrival)

    return round(par_days, 1), round(recommended_qty, 2)


def build_reorder_alerts(ingredients, forecasts_by_ingredient):
    alerts = []
    for _, row in ingredients.iterrows():
        ing_id = row["Ingredient_ID"]
        current_stock = row["Current_stock(kg)"]
        safety_level = row["Safety_Stock_level(kg)"]
        lead_time = row["Reorder_delay(days)"]
        shelf_life = row["Shelf_life(days)"]

        fc = forecasts_by_ingredient.get(ing_id)
        if fc is None or fc.empty:
            continue

        fc = fc.copy()
        fc["cumulative_usage"] = fc["predicted_usage"].cumsum()
        fc["projected_stock"] = current_stock - fc["cumulative_usage"]

        # First day projected stock drops to/below the safety threshold
        breach = fc[fc["projected_stock"] <= safety_level]
        # Reference point is the day after the last known history date, not the
        # real-world clock -- keeps this correct even if the script is run
        # days after the data was last updated.
        forecast_start = fc["Date"].min()
        if breach.empty:
            days_to_safety_breach = None
            order_by_date = None
            status = f"OK - stock lasts {FORECAST_DAYS}+ days"
        else:
            first_breach = breach.iloc[0]
            days_to_safety_breach = (first_breach["Date"] - fc["Date"].min()).days + 1
            order_by_date = first_breach["Date"] - pd.Timedelta(days=lead_time)
            if order_by_date <= forecast_start:
                status = "ORDER NOW - lead time already tight or overdue"
            else:
                status = f"Order by {order_by_date.date()}"

        par_days, recommended_qty = compute_par_level_order(
            fc, current_stock, safety_level, lead_time, shelf_life,
            order_by_date, forecast_start,
        )

        alerts.append({
            "Ingredient_ID": ing_id,
            "Ingredient_name": row["Ingredient_name"],
            "Current_stock(kg)": current_stock,
            "Safety_Stock_level(kg)": safety_level,
            "Shelf_life(days)": shelf_life,
            "Reorder_lead_time(days)": lead_time,
            "avg_daily_usage_forecast(kg)": round(fc["predicted_usage"].mean(), 3),
            "days_until_safety_breach": days_to_safety_breach,
            "order_by_date": order_by_date.date() if order_by_date is not None else None,
            "par_coverage_days": par_days,
            "recommended_order_qty(kg)": recommended_qty,
            "status": status,
        })

    return pd.DataFrame(alerts).sort_values(
        "days_until_safety_breach", na_position="last"
    )


def main():
    ingredients, history, model, all_ids = load_inputs()

    forecasts_by_ingredient = {}
    all_forecasts = []
    for ing_id in all_ids:
        fc = forecast_ingredient(ing_id, history, model, all_ids)
        fc["Ingredient_ID"] = ing_id
        forecasts_by_ingredient[ing_id] = fc
        all_forecasts.append(fc)

    detail = pd.concat(all_forecasts, ignore_index=True)
    detail.to_csv("forecast_detail.csv", index=False)

    alerts = build_reorder_alerts(ingredients, forecasts_by_ingredient)
    alerts.to_csv("reorder_alerts.csv", index=False)

    print(f"Forecasted {FORECAST_DAYS} days ahead for {len(all_ids)} ingredients.\n")
    print("--- Reorder alerts (most urgent first) ---")
    print(alerts.to_string(index=False))
    print("\nSaved: reorder_alerts.csv, forecast_detail.csv")


if __name__ == "__main__":
    main()
