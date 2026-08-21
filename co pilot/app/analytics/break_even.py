def calculate_break_even_quantity(
    current_price,
    cost_price,
    quantity,
    price_change
):

    current_profit = (
        current_price -
        cost_price
    ) * quantity

    new_price = (
        current_price +
        price_change
    )

    new_profit_per_item = (
        new_price -
        cost_price
    )

    if new_profit_per_item <= 0:

        return {
            "error":
                "New price does not produce positive profit."
        }

    break_even_quantity = (
        current_profit /
        new_profit_per_item
    )

    quantity_loss_percent = (
        1 -
        break_even_quantity /
        quantity
    ) * 100

    return {

        "break_even_quantity":
            break_even_quantity,

        "maximum_quantity_loss_percent":
            quantity_loss_percent
    }