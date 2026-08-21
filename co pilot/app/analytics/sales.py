from sqlalchemy import func

from app.models import Product, SaleItem


def get_product_sales(
    db,
    product_name
):

    result = (
        db.query(
            Product.name,
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

    return {
        "product": result.name,
        "quantity_sold": result.quantity
    }