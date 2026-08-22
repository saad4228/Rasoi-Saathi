from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.auth.dependencies import get_current_user, require_roles
from app.database import get_db
from app.models.branch import Branch
from app.models.customer import Customer
from app.models.demand_forecast import DemandForecast
from app.models.inventory_item import InventoryItem
from app.models.inventory_transaction import InventoryTransaction
from app.models.menu_item import MenuItem
from app.models.menu_item_ingredient import MenuItemIngredient
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.purchase_order_item import PurchaseOrderItem
from app.models.restaurant_module import RestaurantModule
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.operations import (
    BranchCreate, BranchResponse, CustomerCreate, CustomerResponse, ForecastResponse, InventoryItemCreate,
    InventoryItemResponse, InventoryItemUpdate, MenuItemCreate, MenuItemResponse, MenuItemUpdate,
    OrderCreate, OrderResponse, OrderStatusUpdate, SubscriptionResponse,
)

router = APIRouter(prefix="/api", tags=["operations"])


def branch_for_user(db: Session, user: User, branch_id: UUID) -> Branch:
    branch = db.scalar(select(Branch).where(Branch.id == branch_id, Branch.restaurant_id == user.restaurant_id))
    if branch is None:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch


@router.get("/branches", response_model=list[BranchResponse])
def list_branches(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Branch).where(Branch.restaurant_id == user.restaurant_id).order_by(Branch.address)).all()


@router.post("/branches", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
def create_branch(payload: BranchCreate, user: User = Depends(require_roles("owner")), db: Session = Depends(get_db)):
    branch = Branch(restaurant_id=user.restaurant_id, **payload.model_dump())
    db.add(branch); db.commit(); db.refresh(branch)
    return branch


def normalize_customer_phone(phone: str) -> str:
    return "".join(character for character in phone.strip() if character.isdigit() or character == "+")


def get_or_create_customer(db: Session, restaurant_id: UUID, payload: CustomerCreate) -> Customer:
    phone = normalize_customer_phone(payload.phone)
    if not phone:
        raise HTTPException(status_code=422, detail="A valid customer phone number is required")

    customer = db.scalar(select(Customer).where(Customer.restaurant_id == restaurant_id, Customer.phone == phone))
    if customer is None:
        customer = Customer(restaurant_id=restaurant_id, phone=phone, name=payload.name, preferred_language=payload.preferred_language)
        db.add(customer)
    else:
        if payload.name is not None:
            customer.name = payload.name
        customer.preferred_language = payload.preferred_language
    db.commit()
    db.refresh(customer)
    return customer


@router.post("/customers/resolve", response_model=CustomerResponse)
def resolve_customer(payload: CustomerCreate, user: User = Depends(require_roles("owner", "chef", "waiter")), db: Session = Depends(get_db)):
    return get_or_create_customer(db, user.restaurant_id, payload)


@router.get("/menu-items", response_model=list[MenuItemResponse])
def list_menu_items(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.scalars(
        select(MenuItem)
        .options(selectinload(MenuItem.ingredients).selectinload(MenuItemIngredient.inventory_item))
        .where(MenuItem.restaurant_id == user.restaurant_id)
        .order_by(MenuItem.category, MenuItem.name)
    ).all()
    return [
        {
            **item.__dict__,
            "ingredients": [
                {
                    "inventory_item_id": ingredient.inventory_item_id,
                    "name": ingredient.inventory_item.name,
                    "unit": ingredient.inventory_item.unit,
                    "quantity_per_unit": ingredient.quantity_per_unit,
                }
                for ingredient in item.ingredients
            ],
            "low_stock_ingredient_count": sum(
                ingredient.inventory_item.current_stock <= ingredient.inventory_item.safety_stock_level
                for ingredient in item.ingredients
            ),
        }
        for item in items
    ]


@router.post("/menu-items", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED)
def create_menu_item(payload: MenuItemCreate, user: User = Depends(require_roles("owner", "chef")), db: Session = Depends(get_db)):
    branch = branch_for_user(db, user, payload.branch_id)

    item = MenuItem(
        restaurant_id=user.restaurant_id,
        name=payload.name,
        description=payload.description,
        category=payload.category,
        food_type=payload.food_type,
        image_url=payload.image_url,
        price=payload.price,
        is_active=payload.is_active,
    )
    db.add(item)
    db.flush()

    for ingredient in payload.ingredients:
        inventory_item = db.scalar(
            select(InventoryItem).where(
                InventoryItem.branch_id == branch.id,
                func.lower(InventoryItem.name) == ingredient.inventory_item_name.strip().lower(),
            )
        )

        if inventory_item is None:
            inventory_item = InventoryItem(
                branch_id=branch.id,
                name=ingredient.inventory_item_name.strip(),
                unit=ingredient.unit,
                current_stock=ingredient.current_stock,
                safety_stock_level=ingredient.safety_stock_level,
                reorder_delay_days=ingredient.reorder_delay_days,
                cost_per_unit=ingredient.cost_per_unit,
                shelf_life_days=ingredient.shelf_life_days,
            )
            db.add(inventory_item)
            db.flush()

        existing_link = db.scalar(
            select(MenuItemIngredient).where(
                MenuItemIngredient.menu_item_id == item.id,
                MenuItemIngredient.inventory_item_id == inventory_item.id,
            )
        )

        if existing_link is None:
            db.add(
                MenuItemIngredient(
                    menu_item_id=item.id,
                    inventory_item_id=inventory_item.id,
                    quantity_per_unit=ingredient.quantity_per_unit,
                )
            )

    db.commit()
    db.refresh(item)
    return item


@router.patch("/menu-items/{item_id}", response_model=MenuItemResponse)
def update_menu_item(item_id: UUID, payload: MenuItemUpdate, user: User = Depends(require_roles("owner", "chef")), db: Session = Depends(get_db)):
    item = db.scalar(
        select(MenuItem)
        .options(selectinload(MenuItem.ingredients).selectinload(MenuItemIngredient.inventory_item))
        .where(MenuItem.id == item_id, MenuItem.restaurant_id == user.restaurant_id)
    )
    if item is None: raise HTTPException(status_code=404, detail="Menu item not found")
    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(item, key, value)
    db.commit(); db.refresh(item)
    return {
        **item.__dict__,
        "ingredients": [
            {
                "inventory_item_id": ingredient.inventory_item_id,
                "name": ingredient.inventory_item.name,
                "unit": ingredient.inventory_item.unit,
                "quantity_per_unit": ingredient.quantity_per_unit,
            }
            for ingredient in item.ingredients
        ],
        "low_stock_ingredient_count": sum(
            ingredient.inventory_item.current_stock <= ingredient.inventory_item.safety_stock_level
            for ingredient in item.ingredients
        ),
    }


@router.delete("/menu-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_menu_item(item_id: UUID, user: User = Depends(require_roles("owner")), db: Session = Depends(get_db)):
    item = db.scalar(select(MenuItem).where(MenuItem.id == item_id, MenuItem.restaurant_id == user.restaurant_id))
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")

    if db.scalar(select(OrderItem.id).where(OrderItem.menu_item_id == item.id).limit(1)) is not None:
        raise HTTPException(status_code=409, detail="This dish cannot be deleted because it is used by an existing order")

    db.execute(delete(MenuItemIngredient).where(MenuItemIngredient.menu_item_id == item.id))
    db.execute(delete(DemandForecast).where(DemandForecast.menu_item_id == item.id))
    db.delete(item)
    db.commit()


@router.get("/inventory-items", response_model=list[InventoryItemResponse])
def list_inventory(branch_id: UUID | None = Query(default=None), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = select(InventoryItem).join(Branch).where(Branch.restaurant_id == user.restaurant_id)
    if branch_id is not None: query = query.where(InventoryItem.branch_id == branch_id)
    items = db.scalars(query.order_by(InventoryItem.name)).all()
    return [inventory_response(item) for item in items]


def inventory_response(item: InventoryItem) -> InventoryItemResponse:
    usage = Decimal("0")
    days = None if usage <= 0 else float(item.current_stock / usage)
    status_value = "out" if item.current_stock <= 0 else "low" if item.current_stock <= item.safety_stock_level else "ok"
    return InventoryItemResponse.model_validate({**item.__dict__, "status": status_value, "days_until_empty": days})


@router.post("/inventory-items", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
def create_inventory(payload: InventoryItemCreate, user: User = Depends(require_roles("owner", "chef")), db: Session = Depends(get_db)):
    branch_for_user(db, user, payload.branch_id)
    item = InventoryItem(**payload.model_dump()); db.add(item); db.commit(); db.refresh(item)
    return inventory_response(item)


@router.patch("/inventory-items/{item_id}", response_model=InventoryItemResponse)
def update_inventory(item_id: UUID, payload: InventoryItemUpdate, user: User = Depends(require_roles("owner", "chef")), db: Session = Depends(get_db)):
    item = db.scalar(select(InventoryItem).join(Branch).where(InventoryItem.id == item_id, Branch.restaurant_id == user.restaurant_id))
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return inventory_response(item)


@router.delete("/inventory-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inventory(item_id: UUID, user: User = Depends(require_roles("owner", "chef")), db: Session = Depends(get_db)):
    item = db.scalar(select(InventoryItem).join(Branch).where(InventoryItem.id == item_id, Branch.restaurant_id == user.restaurant_id))
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    db.execute(delete(MenuItemIngredient).where(MenuItemIngredient.inventory_item_id == item.id))
    db.execute(delete(InventoryTransaction).where(InventoryTransaction.inventory_item_id == item.id))
    db.execute(delete(PurchaseOrderItem).where(PurchaseOrderItem.inventory_item_id == item.id))
    db.delete(item)
    db.commit()


@router.get("/orders", response_model=list[OrderResponse])
def list_orders(branch_id: UUID | None = Query(default=None), order_status: str | None = Query(default=None, alias="status"), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = select(Order).options(selectinload(Order.order_items).selectinload(OrderItem.menu_item)).where(Order.restaurant_id == user.restaurant_id)
    if branch_id is not None: query = query.where(Order.branch_id == branch_id)
    if order_status is not None: query = query.where(Order.status == order_status)
    orders = db.scalars(query.order_by(Order.ordered_at.desc())).all()
    return [OrderResponse(id=o.id, branch_id=o.branch_id, customer_id=o.customer_id, order_source=o.order_source, order_type=o.order_type, status=o.status, total_amount=o.total_amount, ordered_at=o.ordered_at, items=[{"id": i.id, "menu_item_id": i.menu_item_id, "menu_item_name": i.menu_item.name, "quantity": i.quantity, "unit_price": i.unit_price, "total_price": i.total_price} for i in o.order_items]) for o in orders]


@router.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreate, user: User = Depends(require_roles("owner", "chef", "waiter")), db: Session = Depends(get_db)):
    branch = branch_for_user(db, user, payload.branch_id)
    if payload.customer_id is not None and db.scalar(select(Customer.id).where(Customer.id == payload.customer_id, Customer.restaurant_id == user.restaurant_id)) is None:
        raise HTTPException(status_code=404, detail="Customer not found")

    requested_quantities: dict[UUID, int] = {}
    for order_item in payload.items:
        requested_quantities[order_item.menu_item_id] = requested_quantities.get(order_item.menu_item_id, 0) + order_item.quantity
    menu_items = {
        item.id: item
        for item in db.scalars(select(MenuItem).where(MenuItem.id.in_(requested_quantities), MenuItem.restaurant_id == user.restaurant_id, MenuItem.is_active.is_(True))).all()
    }
    if len(menu_items) != len(requested_quantities):
        raise HTTPException(status_code=422, detail="One or more selected menu items are unavailable")

    order = Order(
        restaurant_id=user.restaurant_id,
        branch_id=branch.id,
        customer_id=payload.customer_id,
        order_source="POS",
        order_type=payload.order_type,
        status="PENDING",
        total_amount=sum((menu_items[item_id].price * quantity for item_id, quantity in requested_quantities.items()), Decimal("0")),
        ordered_at=datetime.now(timezone.utc),
    )
    db.add(order)
    db.flush()
    for menu_item_id, quantity in requested_quantities.items():
        menu_item = menu_items[menu_item_id]
        db.add(OrderItem(order_id=order.id, menu_item_id=menu_item_id, quantity=quantity, unit_price=menu_item.price, total_price=menu_item.price * quantity))
    db.commit()
    order = db.scalar(select(Order).options(selectinload(Order.order_items).selectinload(OrderItem.menu_item)).where(Order.id == order.id))
    return OrderResponse(id=order.id, branch_id=order.branch_id, customer_id=order.customer_id, order_source=order.order_source, order_type=order.order_type, status=order.status, total_amount=order.total_amount, ordered_at=order.ordered_at, items=[{"id": i.id, "menu_item_id": i.menu_item_id, "menu_item_name": i.menu_item.name, "quantity": i.quantity, "unit_price": i.unit_price, "total_price": i.total_price} for i in order.order_items])


@router.patch("/orders/{order_id}", response_model=OrderResponse)
def update_order(order_id: UUID, payload: OrderStatusUpdate, user: User = Depends(require_roles("owner", "chef", "waiter")), db: Session = Depends(get_db)):
    order = db.scalar(
        select(Order)
        .options(
            selectinload(Order.order_items)
            .selectinload(OrderItem.menu_item)
            .selectinload(MenuItem.ingredients)
            .selectinload(MenuItemIngredient.inventory_item)
        )
        .where(Order.id == order_id, Order.restaurant_id == user.restaurant_id)
        .with_for_update()
    )
    if order is None: raise HTTPException(status_code=404, detail="Order not found")
    if payload.status == "READY" and user.role not in {"owner", "chef"}:
        raise HTTPException(status_code=403, detail="Only a chef can mark an order ready")
    if payload.status == "COMPLETED" and user.role not in {"owner", "waiter"}:
        raise HTTPException(status_code=403, detail="Only a waiter can complete payment for an order")
    if payload.status == "COMPLETED" and order.status != "READY":
        raise HTTPException(status_code=409, detail="An order must be ready before payment can be completed")

    if order.status != "READY" and payload.status == "READY":
        already_consumed = db.scalar(
            select(InventoryTransaction.id).where(
                InventoryTransaction.reference_id == order.id,
                InventoryTransaction.transaction_type == "CONSUMPTION",
            ).limit(1)
        )
        if already_consumed is None:
            consumption: dict[UUID, Decimal] = {}
            inventory_items: dict[UUID, InventoryItem] = {}
            for order_item in order.order_items:
                for recipe_link in order_item.menu_item.ingredients:
                    inventory_item = db.scalar(
                        select(InventoryItem)
                        .where(InventoryItem.id == recipe_link.inventory_item_id)
                        .with_for_update()
                    )
                    if inventory_item is None:
                        raise HTTPException(status_code=409, detail="An order recipe references a missing inventory item")
                    inventory_items[inventory_item.id] = inventory_item
                    consumption[inventory_item.id] = consumption.get(inventory_item.id, Decimal("0")) + (recipe_link.quantity_per_unit * order_item.quantity)

            insufficient = [
                f"{inventory_items[item_id].name} (need {quantity} {inventory_items[item_id].unit}, have {inventory_items[item_id].current_stock} {inventory_items[item_id].unit})"
                for item_id, quantity in consumption.items()
                if inventory_items[item_id].current_stock < quantity
            ]
            if insufficient:
                raise HTTPException(status_code=409, detail=f"Insufficient inventory to complete order: {', '.join(insufficient)}")

            for item_id, quantity in consumption.items():
                inventory_item = inventory_items[item_id]
                inventory_item.current_stock -= quantity
                db.add(
                    InventoryTransaction(
                        inventory_item_id=item_id,
                        branch_id=order.branch_id,
                        transaction_type="CONSUMPTION",
                        quantity=-quantity,
                        unit_cost=inventory_item.cost_per_unit,
                        reference_id=order.id,
                    )
                )

    order.status = payload.status
    db.commit()
    db.refresh(order)
    return OrderResponse(
        id=order.id,
        branch_id=order.branch_id,
        customer_id=order.customer_id,
        order_source=order.order_source,
        order_type=order.order_type,
        status=order.status,
        total_amount=order.total_amount,
        ordered_at=order.ordered_at,
        items=[
            {"id": item.id, "menu_item_id": item.menu_item_id, "menu_item_name": item.menu_item.name,
             "quantity": item.quantity, "unit_price": item.unit_price, "total_price": item.total_price}
            for item in order.order_items
        ],
    )


@router.get("/forecasts", response_model=list[ForecastResponse])
def list_forecasts(branch_id: UUID | None = Query(default=None), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = select(DemandForecast).join(Branch).where(Branch.restaurant_id == user.restaurant_id)
    if branch_id is not None: query = query.where(DemandForecast.branch_id == branch_id)
    return db.scalars(query.order_by(DemandForecast.forecast_date)).all()


@router.get("/analytics/summary")
def analytics_summary(days: int = Query(default=7, ge=7, le=30), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)
    orders = db.scalars(
        select(Order)
        .options(
            selectinload(Order.order_items)
            .selectinload(OrderItem.menu_item)
            .selectinload(MenuItem.ingredients)
            .selectinload(MenuItemIngredient.inventory_item)
        )
        .where(
            Order.restaurant_id == user.restaurant_id,
            Order.status == "COMPLETED",
            func.date(Order.ordered_at) >= start_date,
            func.date(Order.ordered_at) <= end_date,
        )
    ).all()

    revenue_by_day = {start_date + timedelta(days=offset): {"revenue": Decimal("0"), "orders": 0} for offset in range(days)}
    dish_totals: dict[UUID, dict[str, Decimal | int | str]] = {}
    total_revenue = Decimal("0")
    food_cost = Decimal("0")
    platform_fees = Decimal("0")

    for order in orders:
        order_day = order.ordered_at.date()
        if order_day in revenue_by_day:
            revenue_by_day[order_day]["revenue"] += order.total_amount
            revenue_by_day[order_day]["orders"] += 1
        total_revenue += order.total_amount
        if order.order_source in {"SWIGGY", "ZOMATO"}:
            platform_fees += order.total_amount * Decimal("0.20")

        for order_item in order.order_items:
            menu_item = order_item.menu_item
            dish = dish_totals.setdefault(menu_item.id, {"name": menu_item.name, "revenue": Decimal("0"), "orders": 0, "food_cost": Decimal("0")})
            dish["revenue"] += order_item.total_price
            dish["orders"] += order_item.quantity
            recipe_cost = sum((link.quantity_per_unit * link.inventory_item.cost_per_unit for link in menu_item.ingredients), Decimal("0"))
            dish["food_cost"] += recipe_cost * order_item.quantity
            food_cost += recipe_cost * order_item.quantity

    wastage = food_cost * Decimal("0.08")
    other_costs = total_revenue * Decimal("0.05")
    total_cost = food_cost + platform_fees + wastage + other_costs
    profit = total_revenue - total_cost
    cost_total = total_cost or Decimal("1")
    trend = [
        {"label": day.strftime("%d %b"), "revenue": values["revenue"], "profit": values["revenue"] - (values["revenue"] * Decimal("0.05")), "orders": values["orders"]}
        for day, values in revenue_by_day.items()
    ]
    dishes = [
        {
            "name": values["name"],
            "revenue": values["revenue"],
            "orders": values["orders"],
            "margin": round(float((values["revenue"] - values["food_cost"]) / values["revenue"] * 100), 1) if values["revenue"] else 0.0
        }
        for values in dish_totals.values()
    ]
    return {
        "trend": trend,
        "stats": {
            "total_revenue": total_revenue,
            "total_orders": len(orders),
            "profit_margin": round(float(profit / total_revenue * 100), 1) if total_revenue else 0.0,
            "food_cost_percent": round(float(food_cost / total_revenue * 100), 1) if total_revenue else 0.0,
        },
        "cost_breakdown": [
            {"name": "Food Cost", "value": round(float(food_cost / cost_total * 100), 1), "color": "#F2660D"},
            {"name": "Platform Fees", "value": round(float(platform_fees / cost_total * 100), 1), "color": "#F0A93A"},
            {"name": "Wastage", "value": round(float(wastage / cost_total * 100), 1), "color": "#C9500A"},
            {"name": "Other Costs", "value": round(float(other_costs / cost_total * 100), 1), "color": "#E7DFD1"},
        ],
        "dishes": dishes,
    }


@router.get("/modules", response_model=list[dict])
def list_modules(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [{"id": m.id, "name": m.name, "code": m.code, "description": m.description, "price": m.price} for m in db.scalars(select(RestaurantModule).order_by(RestaurantModule.name)).all()]


@router.get("/subscriptions", response_model=list[SubscriptionResponse])
def list_subscriptions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Subscription).where(Subscription.restaurant_id == user.restaurant_id)).all()


@router.get("/dashboard/summary")
def dashboard_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()
    chart_start = today - timedelta(days=6)
    orders = db.scalars(select(Order).where(Order.restaurant_id == user.restaurant_id, func.date(Order.ordered_at) == today)).all()
    recent = db.scalars(select(Order).where(Order.restaurant_id == user.restaurant_id).order_by(Order.ordered_at.desc()).limit(5)).all()
    low_stock = db.scalar(select(func.count()).select_from(InventoryItem).join(Branch).where(Branch.restaurant_id == user.restaurant_id, InventoryItem.current_stock <= InventoryItem.safety_stock_level)) or 0
    total = sum((order.total_amount for order in orders), Decimal("0"))
    daily_rows = db.execute(
        select(func.date(Order.ordered_at).label("day"), func.coalesce(func.sum(Order.total_amount), 0).label("revenue"), func.count(Order.id).label("orders"))
        .where(Order.restaurant_id == user.restaurant_id, func.date(Order.ordered_at) >= chart_start, func.date(Order.ordered_at) <= today)
        .group_by(func.date(Order.ordered_at))
        .order_by(func.date(Order.ordered_at))
    ).all()
    daily_by_date = {row.day: row for row in daily_rows}
    revenue_series = []
    for offset in range(7):
        series_day = chart_start + timedelta(days=offset)
        row = daily_by_date.get(series_day)
        revenue_series.append({"day": series_day, "revenue": row.revenue if row else Decimal("0"), "orders": row.orders if row else 0})
    return {"today_revenue": total, "today_orders": len(orders), "avg_order_value": total / len(orders) if orders else Decimal("0"), "low_stock_count": low_stock, "total_revenue": total, "revenue_series": revenue_series, "recent_orders": [{"id": str(o.id), "source": o.order_source, "status": o.status, "total": o.total_amount, "ordered_at": o.ordered_at} for o in recent], "insight": None}