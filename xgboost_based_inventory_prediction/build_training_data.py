"""
Step 1-2 of the XGBoost pipeline: turn dish sales into a daily ingredient-usage
table, then engineer features (calendar + lag + rolling) for forecasting.

Input:  ingredient_usage.xlsx  (sheets: Dishes, Ingredients, Recipe_map, Daily_Sales)
Output: daily_ingredient_usage.csv        (raw usage, before features)
        training_data.csv                (usage + engineered features, model-ready)

Run:  python build_training_data.py
"""

import pandas as pd
import numpy as np

SOURCE_FILE = "XGBoost_data.xlsx"


# ---------------------------------------------------------------------------
# Step 1: Load raw sheets
# ---------------------------------------------------------------------------
def load_data(path=SOURCE_FILE):
    sales = pd.read_excel(path, sheet_name="Sales_Data")
    recipe = pd.read_excel(path, sheet_name="Recipe_map")
    ingredients = pd.read_excel(path, sheet_name="Ingredients")

    sales["Date"] = pd.to_datetime(sales["Date"])

    return sales, recipe, ingredients


# ---------------------------------------------------------------------------
# Step 1: Sales -> ingredient usage (join + multiply + sum)
# ---------------------------------------------------------------------------
def compute_daily_usage(sales: pd.DataFrame, recipe: pd.DataFrame) -> pd.DataFrame:
    # Drop rows where Units_Sold hasn't been filled in yet
    sales = sales.dropna(subset=["Units_Sold"]).copy()
    if sales.empty:
        print("WARNING: No Units_Sold values found yet. Fill in the Daily_Sales "
              "sheet, then re-run this script.")
        return pd.DataFrame(columns=["Date", "Ingredient_ID", "quantity_used"])

    merged = sales.merge(recipe, on="Dish_ID", how="left")

    missing = merged[merged["Ingredient_ID"].isna()]["Dish_ID"].unique()
    if len(missing) > 0:
        print(f"WARNING: These Dish_IDs have no recipe_map entries: {missing}")

    # Final_Quantity(kg) is a formula cell in the workbook. Its cached value is
    # only reliable if the file was last saved/recalculated by Excel. To stay
    # robust regardless of how the file was saved, recompute it directly from
    # Quantity_per_unit and Randomness_margin whenever the cached value is
    # missing or looks stale.
    computed_final_qty = merged["Quantity_per_unit(kg)"] * (
        1 + merged["Randomness_margin(%)"] / 100
    )
    merged["Final_Quantity(kg)"] = merged["Final_Quantity(kg)"].fillna(computed_final_qty)

    merged["usage"] = merged["Units_Sold"] * merged["Final_Quantity(kg)"]

    daily_usage = (
        merged.groupby(["Date", "Ingredient_ID"])["usage"]
        .sum()
        .reset_index()
        .rename(columns={"usage": "quantity_used"})
    )
    return daily_usage


# ---------------------------------------------------------------------------
# Step 2: Feature engineering (calendar + lag + rolling)
# ---------------------------------------------------------------------------
def engineer_features(daily_usage: pd.DataFrame) -> pd.DataFrame:
    if daily_usage.empty:
        return daily_usage

    df = daily_usage.sort_values(["Ingredient_ID", "Date"]).copy()

    # --- Calendar features ---
    df["day_of_week"] = df["Date"].dt.dayofweek  # 0=Mon ... 6=Sun
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)
    df["month"] = df["Date"].dt.month
    df["day_of_month"] = df["Date"].dt.day

    # --- Lag features (per ingredient) ---
    # shift(1) / shift(7) look BACKWARD only -- no future leakage
    grp = df.groupby("Ingredient_ID")["quantity_used"]
    df["lag_1"] = grp.shift(1)
    df["lag_7"] = grp.shift(7)

    # --- Rolling averages (also shifted so today's value isn't included) ---
    df["rolling_7_avg"] = (
        grp.transform(lambda s: s.shift(1).rolling(window=7, min_periods=1).mean())
    )
    df["rolling_30_avg"] = (
        grp.transform(lambda s: s.shift(1).rolling(window=30, min_periods=1).mean())
    )

    return df.reset_index(drop=True)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    sales, recipe, ingredients = load_data()

    daily_usage = compute_daily_usage(sales, recipe)
    daily_usage.to_csv("daily_ingredient_usage.csv", index=False)
    print(f"Saved daily_ingredient_usage.csv ({len(daily_usage)} rows)")

    training_data = engineer_features(daily_usage)
    training_data.to_csv("training_data.csv", index=False)
    print(f"Saved training_data.csv ({len(training_data)} rows)")

    if not training_data.empty:
        print("\nPreview:")
        print(training_data.head(10).to_string(index=False))
        print(f"\nDate range: {training_data['Date'].min()} to {training_data['Date'].max()}")
        print(f"Ingredients covered: {training_data['Ingredient_ID'].nunique()}")


if __name__ == "__main__":
    main()
