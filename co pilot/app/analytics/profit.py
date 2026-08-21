from sqlalchemy import func

from app.models import Product, SaleItem


def get_product_profit(
    db,
    product_name
):

    result = (
        db.query(
            Product.id,
            Product.name,
            Product.selling_price,
            Product.cost_price,
            func.coalesce(
                func.sum(SaleItem.quantity),
                0
            ).label("quantity")
        )
        .outerjoin(
            SaleItem,
            SaleItem.product_id == Product.id
        )
        .filter(
            Product.name.ilike(
                f"%{product_name}%"
            )
        )
        .group_by(
            Product.id
        )
        .first()
    )

    if not result:

        return {
            "error":
                f"Product '{product_name}' not found"
        }

    quantity = result.quantity

    revenue = (
        result.selling_price *
        quantity
    )

    cost = (
        result.cost_price *
        quantity
    )

    profit = revenue - cost

    profit_per_item = (
        result.selling_price -
        result.cost_price
    )

    margin_percent = (
        profit_per_item /
        result.selling_price
    ) * 100

    return {

        "product":
            result.name,

        "selling_price":
            result.selling_price,

        "cost_price":
            result.cost_price,

        "quantity_sold":
            quantity,

        "revenue":
            revenue,

        "cost":
            cost,

        "profit":
            profit,

        "profit_per_item":
            profit_per_item,

        "margin_percent":
            margin_percent
    }