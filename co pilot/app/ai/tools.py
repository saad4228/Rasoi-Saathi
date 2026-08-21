from app.analytics.sales import (
    get_product_sales
)

from app.analytics.profit import (
    get_product_profit
)

from app.analytics.simulation import (
    simulate_price_change
)

from app.analytics.break_even import (
    calculate_break_even_quantity
)


def sales_tool(
    db,
    product_name
):

    return get_product_sales(
        db,
        product_name
    )


def profit_tool(
    db,
    product_name
):

    return get_product_profit(
        db,
        product_name
    )


def price_simulation_tool(
    db,
    product_name,
    price_change,
    expected_quantity_change_percent=0
):

    return simulate_price_change(
        db,
        product_name,
        price_change,
        expected_quantity_change_percent
    )


def break_even_tool(
    db,
    product_name,
    price_change
):

    product = get_product_profit(
        db,
        product_name
    )

    if "error" in product:
        return product

    return calculate_break_even_quantity(

        product["selling_price"],
        product["cost_price"],
        product["quantity_sold"],
        price_change
    )