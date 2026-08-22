"""
Step 3 of the XGBoost pipeline: train a model to predict daily ingredient
usage from training_data.csv (produced by build_training_data.py).

Approach: ONE global model, with Ingredient_ID as a categorical feature,
rather than one model per ingredient. With only ~60 days of history, splitting
into 34 separate per-ingredient models would leave each with too few rows to
learn anything reliable. A single model lets ingredients share patterns
(e.g. weekend effect) while still differentiating via the categorical split.

Validation uses a TIME-BASED split (train on earlier dates, test on the most
recent N days) rather than a random split, since a random split would let the
model "see the future" via rows from the same week as training points --
which would make test performance look better than it will be in production.

Output:
    model.json                  -- trained XGBoost model, reloadable later
    predictions_vs_actual.csv   -- test-set predictions for inspection
    feature_importance.csv      -- which features the model relied on
"""

import json
import pandas as pd
import numpy as np
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

DATA_FILE = "training_data.csv"
INGREDIENTS_FILE = "XGBoost_data.xlsx"     # source of truth for the category list
CATEGORIES_FILE = "ingredient_categories.json"
TEST_DAYS = 14  # most recent N days held out for validation

FEATURE_COLS = [
    "Ingredient_ID", "day_of_week", "is_weekend", "month", "day_of_month",
    "lag_1", "lag_7", "rolling_7_avg", "rolling_30_avg",
]
TARGET_COL = "quantity_used"


def load_ingredient_categories(path=INGREDIENTS_FILE):
    """Canonical Ingredient_ID category list, sourced from the Ingredients
    master sheet rather than training_data.csv. This matters: training_data.csv
    only contains ingredients that actually sold during the training window, but
    the master sheet is the true superset (it also covers a brand-new ingredient
    that hasn't sold yet). Deriving categories from training_data.csv instead
    would silently drop any zero-usage ingredient from the category set --
    and reorder_alerts.py, which needs to score every ingredient in the master
    sheet, would then hand the model a category it never saw and crash.
    Persisting this exact list (see CATEGORIES_FILE below) is what keeps
    train-time and inference-time categories identical."""
    ingredients = pd.read_excel(path, sheet_name="Ingredients")
    return sorted(ingredients["Ingredient_ID"].unique())


def load_and_split(path=DATA_FILE, test_days=TEST_DAYS, categories=None):
    df = pd.read_csv(path, parse_dates=["Date"])
    df = df.sort_values("Date").reset_index(drop=True)

    # Explicit, persisted category list -- NOT df["Ingredient_ID"].astype("category"),
    # which would infer categories from only the ingredients present in this file.
    df["Ingredient_ID"] = pd.Categorical(df["Ingredient_ID"], categories=categories)

    split_date = df["Date"].max() - pd.Timedelta(days=test_days - 1)
    train = df[df["Date"] < split_date].copy()
    test = df[df["Date"] >= split_date].copy()

    print(f"Train: {train['Date'].min().date()} to {train['Date'].max().date()} "
          f"({len(train)} rows)")
    print(f"Test:  {test['Date'].min().date()} to {test['Date'].max().date()} "
          f"({len(test)} rows)")

    return train, test


def train_model(train: pd.DataFrame) -> XGBRegressor:
    X_train = train[FEATURE_COLS]
    y_train = train[TARGET_COL]

    model = XGBRegressor(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        enable_categorical=True,   # lets XGBoost natively split on Ingredient_ID
        missing=np.nan,            # early-history lag_1/lag_7 NaNs handled natively
        random_state=42,
    )
    model.fit(X_train, y_train)
    return model


def evaluate(model: XGBRegressor, test: pd.DataFrame) -> pd.DataFrame:
    X_test = test[FEATURE_COLS]
    y_test = test[TARGET_COL]

    preds = model.predict(X_test)
    preds = np.clip(preds, 0, None)  # usage can't be negative

    mae = mean_absolute_error(y_test, preds)
    rmse = np.sqrt(mean_squared_error(y_test, preds))
    r2 = r2_score(y_test, preds)

    # MAPE, guarding against near-zero true values (common for spices like saffron)
    nonzero = y_test > 0.01
    mape = (np.abs((y_test[nonzero] - preds[nonzero]) / y_test[nonzero])).mean() * 100

    print("\n--- Overall test-set performance ---")
    print(f"MAE:  {mae:.3f} kg")
    print(f"RMSE: {rmse:.3f} kg")
    print(f"MAPE: {mape:.1f}%")
    print(f"R^2:  {r2:.3f}")

    result = test[["Date", "Ingredient_ID", TARGET_COL]].copy()
    result["predicted"] = preds
    result["abs_error"] = (result[TARGET_COL] - result["predicted"]).abs()
    return result


def per_ingredient_breakdown(result: pd.DataFrame):
    breakdown = (
        result.groupby("Ingredient_ID", observed=True)
        .apply(lambda g: pd.Series({
            "avg_actual": g[TARGET_COL].mean(),
            "avg_predicted": g["predicted"].mean(),
            "mae": g["abs_error"].mean(),
        }), include_groups=False)
        .sort_values("mae", ascending=False)
    )
    print("\n--- Worst 5 ingredients by MAE ---")
    print(breakdown.head(5).round(3).to_string())
    print("\n--- Best 5 ingredients by MAE ---")
    print(breakdown.tail(5).round(3).to_string())
    return breakdown


def main():
    categories = load_ingredient_categories()
    train, test = load_and_split(categories=categories)
    model = train_model(train)
    result = evaluate(model, test)
    breakdown = per_ingredient_breakdown(result)

    model.save_model("model.json")
    with open(CATEGORIES_FILE, "w") as f:
        json.dump(categories, f)
    result.to_csv("predictions_vs_actual.csv", index=False)
    breakdown.to_csv("per_ingredient_performance.csv")

    importance = pd.DataFrame({
        "feature": FEATURE_COLS,
        "importance": model.feature_importances_,
    }).sort_values("importance", ascending=False)
    importance.to_csv("feature_importance.csv", index=False)
    print("\n--- Feature importance ---")
    print(importance.to_string(index=False))

    print("\nSaved: model.json, ingredient_categories.json, predictions_vs_actual.csv, "
          "per_ingredient_performance.csv, feature_importance.csv")


if __name__ == "__main__":
    main()
