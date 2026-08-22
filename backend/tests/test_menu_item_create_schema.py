from decimal import Decimal

from app.schemas.operations import MenuItemCreate


def test_menu_item_create_keeps_recipe_ingredient_data():
    payload = MenuItemCreate.model_validate(
        {
            "name": "Butter Chicken",
            "category": "Mains",
            "price": "299.00",
            "branch_id": "11111111-1111-4111-8111-111111111111",
            "description": "Rich and spicy chicken curry",
            "ingredients": [
                {
                    "inventory_item_name": "Chicken",
                    "unit": "kg",
                    "current_stock": "12",
                    "safety_stock_level": "5",
                    "cost_per_unit": "220",
                    "quantity_per_unit": "0.25",
                }
            ],
        }
    )

    assert payload.ingredients
    assert payload.ingredients[0].inventory_item_name == "Chicken"
    assert payload.ingredients[0].quantity_per_unit == Decimal("0.25")
