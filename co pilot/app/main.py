from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import Product

from app.analytics.profit import (
    get_product_profit
)
from app.analytics.sales import (
    get_product_sales
)

from app.analytics.simulation import (
    simulate_price_change
)

from app.analytics.break_even import (
    calculate_break_even_quantity
)

from app.ai.agent import run_agent

app = FastAPI(
    title="Restaurant AI"
)


@app.get("/")
def root():

    return {
        "message": "Restaurant AI API is running"
    }


@app.get("/database-test")
def database_test(
    db: Session = Depends(get_db)
):

    return {
        "message": "Database connection successful"
    }


@app.get("/products")
def get_products(
    db: Session = Depends(get_db)
):

    products = db.query(Product).all()

    return [
        {
            "id": product.id,
            "name": product.name,
            "selling_price": product.selling_price,
            "cost_price": product.cost_price
        }
        for product in products
    ]


@app.get("/sales/{product_name}")
def sales(
    product_name: str,
    db: Session = Depends(get_db)
):

    return get_product_sales(
        db,
        product_name
    )

@app.get("/profit/{product_name}")
def profit(
    product_name: str,
    db: Session = Depends(get_db)
):

    return get_product_profit(
        db,
        product_name
    )

@app.get("/simulate-price")
def simulate_price(
    product_name: str,
    price_change: float,
    expected_quantity_change_percent: float = 0,
    db: Session = Depends(get_db)
):

    return simulate_price_change(
        db,
        product_name,
        price_change,
        expected_quantity_change_percent
    )

@app.get("/break-even")
def break_even(
    product_name: str,
    price_change: float,
    db: Session = Depends(get_db)
):

    product = get_product_profit(
        db,
        product_name
    )

    if "error" in product:
        return product

    result = calculate_break_even_quantity(

        current_price=
            product["selling_price"],

        cost_price=
            product["cost_price"],

        quantity=
            product["quantity_sold"],

        price_change=
            price_change
    )

    return {
        "product":
            product["product"],

        "current_price":
            product["selling_price"],

        "cost_price":
            product["cost_price"],

        "current_quantity":
            product["quantity_sold"],

        **result
    }
class ChatRequest(BaseModel):

    message: str


@app.post("/chat")
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db)
):

    answer = run_agent(
        db,
        request.message
    )

    return {
        "answer": answer
    }