from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    Product,
    Sale,
    SaleItem,
    Expense,
    Inventory
)


# =========================================================
# PRODUCT HELPER
# =========================================================

def find_product(
    db: Session,
    product_name: str,
    restaurant_id: str
):
    """
    Find a product by name for a restaurant.
    Case-insensitive matching.
    """

    product_name = product_name.strip()

    product = (
        db.query(Product)
        .filter(
            Product.restaurant_id == int(restaurant_id),
            func.lower(Product.name) == product_name.lower()
        )
        .first()
    )

    return product


# =========================================================
# SALES QUANTITY HELPER
# =========================================================

def get_sales_quantity(
    db: Session,
    product_id: int,
    restaurant_id: str
):
    """
    Calculate total quantity sold for a product.

    Sale
        ↓
    SaleItem
        ↓
    Product
    """

    quantity = (
        db.query(
            func.coalesce(
                func.sum(SaleItem.quantity),
                0
            )
        )
        .join(
            Sale,
            Sale.id == SaleItem.sale_id
        )
        .filter(
            Sale.restaurant_id == int(restaurant_id),
            SaleItem.product_id == product_id
        )
        .scalar()
    )

    return int(quantity or 0)


# =========================================================
# PRODUCTS TOOL
# =========================================================

def products_tool(
    db: Session,
    restaurant_id: str
):

    products = (
        db.query(Product)
        .filter(
            Product.restaurant_id == int(restaurant_id)
        )
        .order_by(Product.name)
        .all()
    )

    return {
        "products": [
            {
                "id": product.id,
                "name": product.name,
                "category": product.category,
                "selling_price": float(
                    product.selling_price
                ),
                "cost_price": float(
                    product.cost_price
                )
            }
            for product in products
        ]
    }


# =========================================================
# SALES TOOL
# =========================================================

def sales_tool(
    db: Session,
    product_name: str,
    restaurant_id: str,
    branch_id: str = None
):

    product = find_product(
        db,
        product_name,
        restaurant_id
    )

    if not product:

        return {
            "error":
                f"Product '{product_name}' was not found."
        }

    quantity = get_sales_quantity(
        db,
        product.id,
        restaurant_id
    )

    return {

        "product":
            product.name,

        "quantity_sold":
            quantity,

        "selling_price":
            float(product.selling_price),

        "restaurant_id":
            str(restaurant_id)
    }


# =========================================================
# PROFIT TOOL
# =========================================================

def profit_tool(
    db: Session,
    product_name: str,
    restaurant_id: str,
    branch_id: str = None
):

    product = find_product(
        db,
        product_name,
        restaurant_id
    )

    if not product:

        return {
            "error":
                f"Product '{product_name}' was not found."
        }

    quantity = get_sales_quantity(
        db,
        product.id,
        restaurant_id
    )

    selling_price = float(
        product.selling_price
    )

    cost_price = float(
        product.cost_price
    )

    revenue = (
        selling_price *
        quantity
    )

    total_cost = (
        cost_price *
        quantity
    )

    profit = (
        revenue -
        total_cost
    )

    margin = (
        (profit / revenue) * 100
        if revenue > 0
        else 0
    )

    return {

        "product":
            product.name,

        "selling_price":
            round(
                selling_price,
                2
            ),

        "cost_price":
            round(
                cost_price,
                2
            ),

        "quantity_sold":
            quantity,

        "revenue":
            round(
                revenue,
                2
            ),

        "total_cost":
            round(
                total_cost,
                2
            ),

        "profit":
            round(
                profit,
                2
            ),

        "profit_margin_percent":
            round(
                margin,
                2
            )
    }


# =========================================================
# PRICE SIMULATION TOOL
# =========================================================

def price_simulation_tool(
    db: Session,
    product_name: str,
    price_change: float,
    expected_quantity_change_percent: float = 0,
    restaurant_id: str = "1",
    branch_id: str = None
):

    product = find_product(
        db,
        product_name,
        restaurant_id
    )

    if not product:

        return {
            "error":
                f"Product '{product_name}' was not found."
        }

    current_price = float(
        product.selling_price
    )

    cost_price = float(
        product.cost_price
    )

    current_quantity = get_sales_quantity(
        db,
        product.id,
        restaurant_id
    )

    new_price = (
        current_price +
        price_change
    )

    if new_price <= 0:

        return {
            "error":
                "New price must be greater than zero."
        }

    quantity_factor = (
        1 +
        expected_quantity_change_percent / 100
    )

    expected_quantity = (
        current_quantity *
        quantity_factor
    )

    current_profit = (
        current_price -
        cost_price
    ) * current_quantity

    expected_new_profit = (
        new_price -
        cost_price
    ) * expected_quantity

    profit_change = (
        expected_new_profit -
        current_profit
    )

    return {

        "product":
            product.name,

        "current_price":
            round(
                current_price,
                2
            ),

        "new_price":
            round(
                new_price,
                2
            ),

        "cost_price":
            round(
                cost_price,
                2
            ),

        "current_quantity":
            current_quantity,

        "expected_quantity":
            round(
                expected_quantity,
                2
            ),

        "current_profit":
            round(
                current_profit,
                2
            ),

        "expected_new_profit":
            round(
                expected_new_profit,
                2
            ),

        "profit_change":
            round(
                profit_change,
                2
            ),

        "expected_quantity_change_percent":
            expected_quantity_change_percent
    }


# =========================================================
# BREAK-EVEN TOOL
# =========================================================

def break_even_tool(
    db: Session,
    product_name: str,
    price_change: float,
    restaurant_id: str = "1",
    branch_id: str = None
):

    product = find_product(
        db,
        product_name,
        restaurant_id
    )

    if not product:

        return {
            "error":
                f"Product '{product_name}' was not found."
        }

    current_price = float(
        product.selling_price
    )

    cost_price = float(
        product.cost_price
    )

    quantity = get_sales_quantity(
        db,
        product.id,
        restaurant_id
    )

    if quantity <= 0:

        return {
            "error":
                "No sales found for this product."
        }

    current_profit = (
        current_price -
        cost_price
    ) * quantity

    new_price = (
        current_price +
        price_change
    )

    if new_price <= 0:

        return {
            "error":
                "New price must be greater than zero."
        }

    new_profit_per_item = (
        new_price -
        cost_price
    )

    if new_profit_per_item <= 0:

        return {
            "error":
                "The new price does not cover the product cost."
        }

    break_even_quantity = (
        current_profit /
        new_profit_per_item
    )

    quantity_loss = (
        quantity -
        break_even_quantity
    )

    quantity_loss_percent = (
        quantity_loss /
        quantity *
        100
    )

    return {

        "product":
            product.name,

        "current_price":
            round(
                current_price,
                2
            ),

        "new_price":
            round(
                new_price,
                2
            ),

        "cost_price":
            round(
                cost_price,
                2
            ),

        "current_quantity":
            quantity,

        "current_profit":
            round(
                current_profit,
                2
            ),

        "break_even_quantity":
            round(
                break_even_quantity,
                2
            ),

        "maximum_units_lost":
            round(
                max(quantity_loss, 0),
                2
            ),

        "maximum_quantity_loss_percent":
            round(
                max(
                    quantity_loss_percent,
                    0
                ),
                2
            )
    }


# =========================================================
# EXPENSE TOOL
# =========================================================

def expenses_tool(
    db: Session,
    restaurant_id: str
):

    expenses = (
        db.query(Expense)
        .filter(
            Expense.restaurant_id ==
            int(restaurant_id)
        )
        .order_by(
            Expense.date.desc()
        )
        .all()
    )

    total = sum(
        float(expense.amount)
        for expense in expenses
    )

    return {

        "total_expenses":
            round(total, 2),

        "expenses": [

            {
                "id": expense.id,

                "category":
                    expense.category,

                "amount":
                    float(expense.amount),

                "date":
                    str(expense.date)
            }

            for expense in expenses
        ]
    }


# =========================================================
# INVENTORY TOOL
# =========================================================

def inventory_tool(
    db: Session,
    restaurant_id: str
):

    products = (
        db.query(Product)
        .filter(
            Product.restaurant_id ==
            int(restaurant_id)
        )
        .all()
    )

    inventory_data = []

    for product in products:

        inventory = (
            db.query(Inventory)
            .filter(
                Inventory.product_id ==
                product.id
            )
            .first()
        )

        inventory_data.append({

            "product":
                product.name,

            "product_id":
                product.id,

            "quantity":
                float(
                    inventory.quantity
                )
                if inventory
                else 0
        })

    return {
        "inventory":
            inventory_data
    }