from app.analytics.profit import (
    get_product_profit
)


def simulate_price_change(
    db,
    product_name,
    price_change,
    expected_quantity_change_percent=0
):

    product = get_product_profit(
        db,
        product_name
    )

    if "error" in product:

        return product

    current_price = product["selling_price"]

    cost_price = product["cost_price"]

    current_quantity = product["quantity_sold"]

    new_price = (
        current_price +
        price_change
    )

    new_quantity = (
        current_quantity *
        (
            1 +
            expected_quantity_change_percent /
            100
        )
    )

    current_profit = (
        current_price -
        cost_price
    ) * current_quantity

    new_profit = (
        new_price -
        cost_price
    ) * new_quantity

    profit_change = (
        new_profit -
        current_profit
    )

    return {

        "product":
            product_name,

        "current_price":
            current_price,

        "new_price":
            new_price,

        "cost_price":
            cost_price,

        "current_quantity":
            current_quantity,

        "expected_new_quantity":
            new_quantity,

        "current_profit":
            current_profit,

        "expected_new_profit":
            new_profit,

        "profit_change":
            profit_change
    }