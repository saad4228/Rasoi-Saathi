import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.auth.dependencies import get_current_user, require_roles
from app.config import get_settings
from app.database import get_db
from app.demo import forbid_in_demo
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
from app.models.restaurant import Restaurant
from app.models.restaurant_module import RestaurantModule
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.operations import (
    BranchCreate, BranchResponse, BranchUpdate, CustomerCreate, CustomerResponse, ForecastResponse, InventoryItemCreate,
    InventoryItemResponse, InventoryItemUpdate, InventoryMovementCreate, MenuItemCreate, MenuItemResponse, MenuItemUpdate,
    OrderCreate, OrderResponse, OrderStatus, OrderStatusUpdate, SubscriptionResponse, SubscriptionUpdate,
    StaffMemberCreate, StaffMemberResponse, StaffMemberUpdate,
)
from app.services.order_rules import transition_error
from app.services.reporting import day_start_utc, local_date, local_today

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["operations"])

owner_only = require_roles("owner")
AGGREGATOR_SOURCES = frozenset({"SWIGGY", "ZOMATO"})
WASTAGE_TYPES = ("WASTE", "WASTAGE")


def branch_for_user(db: Session, user: User, branch_id: UUID, *, active_only: bool = False) -> Branch:
    branch = db.scalar(select(Branch).where(Branch.id == branch_id, Branch.restaurant_id == user.restaurant_id))
    if branch is None:
        raise HTTPException(status_code=404, detail="Branch not found")
    if active_only and not branch.is_active:
        raise HTTPException(status_code=409, detail="This branch is inactive. Reactivate it under Settings -> Outlets first.")
    return branch


def restaurant_name(db: Session, user: User) -> str:
    restaurant = db.get(Restaurant, user.restaurant_id)
    return restaurant.name if restaurant else "My Restaurant"


def branch_response(branch: Branch, name: str) -> BranchResponse:
    return BranchResponse(
        id=branch.id,
        restaurant_name=name,
        address=branch.address,
        phone=branch.phone,
        is_active=branch.is_active,
        supports_dine_in=branch.supports_dine_in,
        supports_takeaway=branch.supports_takeaway,
        supports_delivery=branch.supports_delivery,
    )


@router.get("/restaurant")
def get_restaurant(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    restaurant = db.get(Restaurant, user.restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return {
        "id": restaurant.id,
        "name": restaurant.name,
        "email": restaurant.email,
        "phone": restaurant.phone,
    }


@router.get("/branches", response_model=list[BranchResponse])
def list_branches(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = restaurant_name(db, user)
    branches = db.scalars(
        select(Branch).where(Branch.restaurant_id == user.restaurant_id).order_by(Branch.created_at, Branch.address)
    ).all()
    return [branch_response(branch, name) for branch in branches]


@router.post("/branches", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
def create_branch(payload: BranchCreate, user: User = Depends(owner_only), db: Session = Depends(get_db)):
    forbid_in_demo(user.restaurant_id, "Adding outlets")
    branch = Branch(restaurant_id=user.restaurant_id, **payload.model_dump())
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch_response(branch, restaurant_name(db, user))


@router.patch("/branches/{branch_id}", response_model=BranchResponse)
def update_branch(branch_id: UUID, payload: BranchUpdate, user: User = Depends(owner_only), db: Session = Depends(get_db)):
    forbid_in_demo(user.restaurant_id, "Editing outlets")
    branch = branch_for_user(db, user, branch_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is None and key != "phone":
            continue
        setattr(branch, key, value)
    db.commit()
    db.refresh(branch)
    return branch_response(branch, restaurant_name(db, user))


def normalize_customer_phone(phone: str) -> str:
    return "".join(character for character in phone.strip() if character.isdigit() or character == "+")


def get_or_create_customer(db: Session, restaurant_id: UUID, payload: CustomerCreate) -> Customer:
    phone = normalize_customer_phone(payload.phone)
    if not phone:
        raise HTTPException(status_code=422, detail="A valid customer phone number is required")

    customer = db.scalar(select(Customer).where(Customer.restaurant_id == restaurant_id, Customer.phone == phone))
    if customer is None:
        try:
            with db.begin_nested():
                customer = Customer(restaurant_id=restaurant_id, phone=phone, name=payload.name, preferred_language=payload.preferred_language)
                db.add(customer)
        except IntegrityError:
            customer = db.scalar(select(Customer).where(Customer.restaurant_id == restaurant_id, Customer.phone == phone))
    else:
        if payload.name is not None:
            customer.name = payload.name
        customer.preferred_language = payload.preferred_language
    db.commit()
    db.refresh(customer)
    return customer


@router.post("/customers/resolve", response_model=CustomerResponse)
def resolve_customer(payload: CustomerCreate, user: User = Depends(require_roles("owner", "chef", "waiter")), db: Session = Depends(get_db)):
    # Customers get real WhatsApp alerts, so demo visitors can't add phone numbers.
    forbid_in_demo(user.restaurant_id, "Adding customers")
    return get_or_create_customer(db, user.restaurant_id, payload)


# ─── Menu ─────────────────────────────────────────────────────────────────────

def menu_item_query():
    return select(MenuItem).options(selectinload(MenuItem.ingredients).selectinload(MenuItemIngredient.inventory_item))


def branch_recipe(item: MenuItem, branch_id: UUID | None) -> list[MenuItemIngredient]:
    """Recipe lines for one branch. A dish is restaurant-wide but its ingredients are branch stock."""
    return [link for link in item.ingredients if branch_id is None or link.inventory_item.branch_id == branch_id]


def recipe_cost(item: MenuItem, branch_id: UUID) -> Decimal:
    return sum(
        (link.quantity_per_unit * link.inventory_item.cost_per_unit for link in branch_recipe(item, branch_id)),
        Decimal("0"),
    )


def menu_item_response(item: MenuItem, branch_id: UUID | None = None) -> dict:
    links = branch_recipe(item, branch_id)
    return {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "category": item.category,
        "food_type": item.food_type,
        "image_url": item.image_url,
        "price": item.price,
        "is_active": item.is_active,
        "ingredients": [
            {
                "inventory_item_id": link.inventory_item_id,
                "branch_id": link.inventory_item.branch_id,
                "name": link.inventory_item.name,
                "unit": link.inventory_item.unit,
                "quantity_per_unit": link.quantity_per_unit,
            }
            for link in links
        ],
        "low_stock_ingredient_count": sum(
            1 for link in links if link.inventory_item.current_stock <= link.inventory_item.safety_stock_level
        ),
    }


def load_menu_item(db: Session, user: User, item_id: UUID) -> MenuItem:
    item = db.scalar(menu_item_query().where(MenuItem.id == item_id, MenuItem.restaurant_id == user.restaurant_id))
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return item


@router.get("/menu-items", response_model=list[MenuItemResponse])
def list_menu_items(
    branch_id: UUID | None = Query(default=None, description="Only include recipe lines for this branch"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if branch_id is not None:
        branch_for_user(db, user, branch_id)
    items = db.scalars(
        menu_item_query().where(MenuItem.restaurant_id == user.restaurant_id).order_by(MenuItem.category, MenuItem.name)
    ).all()
    return [menu_item_response(item, branch_id) for item in items]


@router.post("/menu-items", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED)
def create_menu_item(payload: MenuItemCreate, user: User = Depends(require_roles("owner", "chef")), db: Session = Depends(get_db)):
    branch = branch_for_user(db, user, payload.branch_id)

    item = MenuItem(
        restaurant_id=user.restaurant_id,
        name=payload.name.strip(),
        description=payload.description,
        category=payload.category,
        food_type=payload.food_type,
        image_url=payload.image_url,
        price=payload.price,
        is_active=payload.is_active,
    )
    db.add(item)
    db.flush()

    linked: set[UUID] = set()
    for ingredient in payload.ingredients:
        if ingredient.inventory_item_id is not None:
            inventory_item = db.scalar(
                select(InventoryItem).where(
                    InventoryItem.id == ingredient.inventory_item_id,
                    InventoryItem.branch_id == branch.id,
                    InventoryItem.is_active.is_(True),
                )
            )
            if inventory_item is None:
                raise HTTPException(status_code=422, detail="A recipe ingredient does not belong to the selected branch.")
        else:
            name = ingredient.inventory_item_name.strip()
            inventory_item = db.scalar(
                select(InventoryItem).where(
                    InventoryItem.branch_id == branch.id,
                    InventoryItem.is_active.is_(True),
                    func.lower(InventoryItem.name) == name.lower(),
                )
            )
            if inventory_item is None:
                inventory_item = InventoryItem(
                    branch_id=branch.id,
                    name=name,
                    unit=ingredient.unit,
                    current_stock=ingredient.current_stock,
                    safety_stock_level=ingredient.safety_stock_level,
                    reorder_delay_days=ingredient.reorder_delay_days,
                    cost_per_unit=ingredient.cost_per_unit,
                    shelf_life_days=ingredient.shelf_life_days,
                )
                db.add(inventory_item)
                db.flush()

        if inventory_item.id in linked:
            continue
        linked.add(inventory_item.id)
        db.add(
            MenuItemIngredient(
                menu_item_id=item.id,
                inventory_item_id=inventory_item.id,
                quantity_per_unit=ingredient.quantity_per_unit,
            )
        )

    db.commit()
    return menu_item_response(load_menu_item(db, user, item.id), branch.id)


@router.patch("/menu-items/{item_id}", response_model=MenuItemResponse)
def update_menu_item(
    item_id: UUID,
    payload: MenuItemUpdate,
    branch_id: UUID | None = Query(default=None),
    user: User = Depends(require_roles("owner", "chef")),
    db: Session = Depends(get_db),
):
    item = load_menu_item(db, user, item_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    return menu_item_response(load_menu_item(db, user, item_id), branch_id)


@router.delete("/menu-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_menu_item(item_id: UUID, user: User = Depends(owner_only), db: Session = Depends(get_db)):
    item = db.scalar(select(MenuItem).where(MenuItem.id == item_id, MenuItem.restaurant_id == user.restaurant_id))
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")

    if db.scalar(select(OrderItem.id).where(OrderItem.menu_item_id == item.id).limit(1)) is not None:
        raise HTTPException(
            status_code=409,
            detail="This dish appears in past orders, so it can't be deleted. Mark it unavailable instead.",
        )

    db.execute(delete(MenuItemIngredient).where(MenuItemIngredient.menu_item_id == item.id))
    db.execute(delete(DemandForecast).where(DemandForecast.menu_item_id == item.id))
    db.delete(item)
    db.commit()


# ─── Inventory ────────────────────────────────────────────────────────────────

def inventory_response(item: InventoryItem) -> InventoryItemResponse:
    status_value = "out" if item.current_stock <= 0 else "low" if item.current_stock <= item.safety_stock_level else "ok"
    return InventoryItemResponse(
        id=item.id,
        branch_id=item.branch_id,
        name=item.name,
        unit=item.unit,
        current_stock=item.current_stock,
        safety_stock_level=item.safety_stock_level,
        reorder_delay_days=item.reorder_delay_days,
        cost_per_unit=item.cost_per_unit,
        shelf_life_days=item.shelf_life_days,
        status=status_value,
    )


def ensure_unique_inventory_name(db: Session, branch_id: UUID, name: str, exclude_id: UUID | None = None) -> None:
    query = select(InventoryItem.id).where(
        InventoryItem.branch_id == branch_id,
        InventoryItem.is_active.is_(True),
        func.lower(InventoryItem.name) == name.strip().lower(),
    )
    if exclude_id is not None:
        query = query.where(InventoryItem.id != exclude_id)
    if db.scalar(query.limit(1)) is not None:
        raise HTTPException(status_code=409, detail=f"'{name.strip()}' already exists in this branch's inventory.")


def owned_inventory_item(db: Session, user: User, item_id: UUID) -> InventoryItem:
    item = db.scalar(
        select(InventoryItem)
        .join(Branch)
        .where(InventoryItem.id == item_id, InventoryItem.is_active.is_(True), Branch.restaurant_id == user.restaurant_id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return item


def record_stock_change(db: Session, item: InventoryItem, transaction_type: str, quantity: Decimal, unit_cost: Decimal | None = None) -> None:
    """Keep the stock ledger in step with every manual stock change."""
    db.add(
        InventoryTransaction(
            inventory_item_id=item.id,
            branch_id=item.branch_id,
            transaction_type=transaction_type,
            quantity=quantity,
            unit_cost=unit_cost if unit_cost is not None else item.cost_per_unit,
        )
    )


@router.get("/inventory-items", response_model=list[InventoryItemResponse])
def list_inventory(branch_id: UUID | None = Query(default=None), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = select(InventoryItem).join(Branch).where(Branch.restaurant_id == user.restaurant_id, InventoryItem.is_active.is_(True))
    if branch_id is not None:
        query = query.where(InventoryItem.branch_id == branch_id)
    items = db.scalars(query.order_by(InventoryItem.name)).all()
    return [inventory_response(item) for item in items]


@router.post("/inventory-items", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
def create_inventory(payload: InventoryItemCreate, user: User = Depends(owner_only), db: Session = Depends(get_db)):
    branch_for_user(db, user, payload.branch_id)
    ensure_unique_inventory_name(db, payload.branch_id, payload.name)
    item = InventoryItem(**{**payload.model_dump(), "name": payload.name.strip()})
    db.add(item)
    db.flush()
    if item.current_stock > 0:
        record_stock_change(db, item, "ADJUSTMENT", item.current_stock)
    db.commit()
    db.refresh(item)
    return inventory_response(item)


@router.patch("/inventory-items/{item_id}", response_model=InventoryItemResponse)
def update_inventory(item_id: UUID, payload: InventoryItemUpdate, user: User = Depends(owner_only), db: Session = Depends(get_db)):
    item = owned_inventory_item(db, user, item_id)
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("name"):
        ensure_unique_inventory_name(db, item.branch_id, changes["name"], exclude_id=item.id)
        changes["name"] = changes["name"].strip()
    previous_stock = item.current_stock
    for key, value in changes.items():
        if value is None and key != "shelf_life_days":
            continue
        setattr(item, key, value)
    if item.current_stock != previous_stock:
        record_stock_change(db, item, "ADJUSTMENT", item.current_stock - previous_stock)
    db.commit()
    db.refresh(item)
    return inventory_response(item)


@router.post("/inventory-items/{item_id}/movements", response_model=InventoryItemResponse)
def record_inventory_movement(item_id: UUID, payload: InventoryMovementCreate, user: User = Depends(owner_only), db: Session = Depends(get_db)):
    """Record stock received from a supplier or thrown away."""
    item = db.scalar(
        select(InventoryItem)
        .join(Branch)
        .where(InventoryItem.id == item_id, InventoryItem.is_active.is_(True), Branch.restaurant_id == user.restaurant_id)
        .with_for_update(of=InventoryItem)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    if payload.type == "PURCHASE":
        if payload.unit_cost is not None:
            item.cost_per_unit = payload.unit_cost
        item.current_stock += payload.quantity
        record_stock_change(db, item, "PURCHASE", payload.quantity, payload.unit_cost)
    else:
        wasted = min(payload.quantity, item.current_stock)
        if wasted <= 0:
            raise HTTPException(status_code=409, detail=f"There is no {item.name} in stock to write off.")
        item.current_stock -= wasted
        record_stock_change(db, item, "WASTE", -wasted)
    db.commit()
    db.refresh(item)
    return inventory_response(item)


@router.delete("/inventory-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inventory(item_id: UUID, user: User = Depends(owner_only), db: Session = Depends(get_db)):
    """Delete an unused item; archive one with stock history so reports keep it."""
    item = owned_inventory_item(db, user, item_id)
    db.execute(delete(MenuItemIngredient).where(MenuItemIngredient.inventory_item_id == item.id))
    has_history = (
        db.scalar(select(InventoryTransaction.id).where(InventoryTransaction.inventory_item_id == item.id).limit(1)) is not None
        or db.scalar(select(PurchaseOrderItem.id).where(PurchaseOrderItem.inventory_item_id == item.id).limit(1)) is not None
    )
    if has_history:
        item.is_active = False
    else:
        db.delete(item)
    db.commit()


# ─── Orders ───────────────────────────────────────────────────────────────────

def order_query():
    return select(Order).options(
        selectinload(Order.order_items).selectinload(OrderItem.menu_item),
        selectinload(Order.customer),
    )


def order_response(order: Order, inventory_warnings: list[str] | None = None) -> OrderResponse:
    return OrderResponse(
        id=order.id,
        branch_id=order.branch_id,
        customer_id=order.customer_id,
        customer_name=order.customer.name if order.customer else None,
        customer_phone=order.customer.phone if order.customer else None,
        order_source=order.order_source,
        order_type=order.order_type,
        status=order.status,
        total_amount=order.total_amount,
        ordered_at=order.ordered_at,
        items=[
            {
                "id": item.id,
                "menu_item_id": item.menu_item_id,
                "menu_item_name": item.menu_item.name,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total_price": item.total_price,
            }
            for item in order.order_items
        ],
        inventory_warnings=inventory_warnings or [],
    )


@router.get("/orders", response_model=list[OrderResponse])
def list_orders(
    branch_id: UUID | None = Query(default=None),
    order_status: OrderStatus | None = Query(default=None, alias="status"),
    since: datetime | None = Query(default=None, description="Only orders placed at or after this time"),
    limit: int = Query(default=200, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = order_query().where(Order.restaurant_id == user.restaurant_id)
    if branch_id is not None:
        query = query.where(Order.branch_id == branch_id)
    if order_status is not None:
        query = query.where(Order.status == order_status)
    if since is not None:
        since_utc = since.astimezone(timezone.utc) if since.tzinfo else since.replace(tzinfo=timezone.utc)
        query = query.where(Order.ordered_at >= since_utc)
    orders = db.scalars(query.order_by(Order.ordered_at.desc()).limit(limit)).all()
    return [order_response(order) for order in orders]


@router.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreate, user: User = Depends(require_roles("owner", "chef", "waiter")), db: Session = Depends(get_db)):
    branch = branch_for_user(db, user, payload.branch_id, active_only=True)
    supported = {
        "DINE_IN": branch.supports_dine_in,
        "TAKEAWAY": branch.supports_takeaway,
        "DELIVERY": branch.supports_delivery,
    }
    if not supported[payload.order_type]:
        raise HTTPException(status_code=422, detail=f"This branch does not accept {payload.order_type.replace('_', ' ').lower()} orders.")
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
    return order_response(db.scalar(order_query().where(Order.id == order.id)))


def consume_recipe_stock(db: Session, order: Order) -> list[str]:
    """Deduct this order's recipe ingredients from its own branch's stock, once.

    Returns human-readable warnings when recorded stock was lower than the recipe
    needs. The kitchen is never blocked: the food has already been cooked, so the
    stock is floored at zero and the shortfall is reported for a recount.
    """
    already_consumed = db.scalar(
        select(InventoryTransaction.id).where(
            InventoryTransaction.reference_id == order.id,
            InventoryTransaction.transaction_type == "CONSUMPTION",
        ).limit(1)
    )
    if already_consumed is not None:
        return []

    required: dict[UUID, Decimal] = {}
    for order_item in order.order_items:
        for link in branch_recipe(order_item.menu_item, order.branch_id):
            required[link.inventory_item_id] = required.get(link.inventory_item_id, Decimal("0")) + link.quantity_per_unit * order_item.quantity
    if not required:
        return []

    # Lock in a fixed order so two tickets sharing ingredients can't deadlock, and
    # re-read the rows under the lock (populate_existing) instead of trusting values
    # loaded before the lock was taken.
    locked_items = db.scalars(
        select(InventoryItem)
        .where(InventoryItem.id.in_(list(required)))
        .order_by(InventoryItem.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).all()

    warnings: list[str] = []
    for inventory_item in locked_items:
        needed = required[inventory_item.id]
        available = max(inventory_item.current_stock, Decimal("0"))
        used = min(needed, available)
        if used < needed:
            warnings.append(
                f"{inventory_item.name}: recipe needs {needed.normalize():f} {inventory_item.unit} but only "
                f"{available.normalize():f} {inventory_item.unit} was in stock. Please recount."
            )
        inventory_item.current_stock = available - used
        db.add(
            InventoryTransaction(
                inventory_item_id=inventory_item.id,
                branch_id=order.branch_id,
                transaction_type="CONSUMPTION",
                quantity=-used,
                unit_cost=inventory_item.cost_per_unit,
                reference_id=order.id,
            )
        )
    return warnings


def send_ready_notification(**message) -> None:
    try:
        from app.services.whatsapp_bot import send_whatsapp_order_ready_notification

        send_whatsapp_order_ready_notification(**message)
    except Exception as notify_err:  # noqa: BLE001 - a failed notification must not fail the kitchen update
        logger.warning("Could not dispatch WhatsApp ready notification: %s", notify_err)


def queue_ready_notification(background_tasks: BackgroundTasks, db: Session, order: Order) -> None:
    """Send the customer's WhatsApp alert after the response, so the kitchen screen doesn't wait on Twilio."""
    customer = order.customer
    if customer is None or not customer.phone:
        return
    restaurant = db.get(Restaurant, order.restaurant_id)
    items_text = ", ".join(f"{item.quantity}x {item.menu_item.name}" for item in order.order_items if item.menu_item)
    background_tasks.add_task(
        send_ready_notification,
        customer_phone=customer.phone,
        restaurant_name=restaurant.name if restaurant else "Restaurant",
        order_id=str(order.id),
        items_summary=items_text or "Dishes",
        order_type=order.order_type,
    )


@router.patch("/orders/{order_id}", response_model=OrderResponse)
def update_order(
    order_id: UUID,
    payload: OrderStatusUpdate,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_roles("owner", "chef", "waiter")),
    db: Session = Depends(get_db),
):
    order = db.scalar(
        select(Order)
        .options(
            selectinload(Order.order_items)
            .selectinload(OrderItem.menu_item)
            .selectinload(MenuItem.ingredients)
            .selectinload(MenuItemIngredient.inventory_item),
            selectinload(Order.customer),
        )
        .where(Order.id == order_id, Order.restaurant_id == user.restaurant_id)
        .with_for_update(of=Order)
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if payload.status == order.status:
        return order_response(order)

    problem = transition_error(order.status, payload.status, user.role)
    if problem is not None:
        raise HTTPException(status_code=problem[0], detail=problem[1])

    warnings = consume_recipe_stock(db, order) if payload.status == "READY" else []
    order.status = payload.status
    db.commit()

    order = db.scalar(order_query().where(Order.id == order_id))
    if payload.status == "READY":
        queue_ready_notification(background_tasks, db, order)
    return order_response(order, warnings)


@router.get("/forecasts", response_model=list[ForecastResponse])
def list_forecasts(branch_id: UUID | None = Query(default=None), user: User = Depends(owner_only), db: Session = Depends(get_db)):
    query = select(DemandForecast).join(Branch).where(Branch.restaurant_id == user.restaurant_id)
    if branch_id is not None:
        query = query.where(DemandForecast.branch_id == branch_id)
    return db.scalars(query.order_by(DemandForecast.forecast_date)).all()


# ─── Reporting ────────────────────────────────────────────────────────────────

def wastage_cost(db: Session, restaurant_id: UUID, branch_id: UUID | None, start: datetime, end: datetime) -> Decimal:
    query = (
        select(InventoryTransaction.quantity, InventoryTransaction.unit_cost, InventoryItem.cost_per_unit)
        .join(InventoryItem, InventoryItem.id == InventoryTransaction.inventory_item_id)
        .join(Branch, Branch.id == InventoryItem.branch_id)
        .where(
            Branch.restaurant_id == restaurant_id,
            InventoryTransaction.transaction_type.in_(WASTAGE_TYPES),
            InventoryTransaction.created_at >= start,
            InventoryTransaction.created_at < end,
        )
    )
    if branch_id is not None:
        query = query.where(InventoryTransaction.branch_id == branch_id)
    return sum(
        (abs(quantity) * (unit_cost if unit_cost is not None else cost_per_unit) for quantity, unit_cost, cost_per_unit in db.execute(query)),
        Decimal("0"),
    )


def percent(part: Decimal, whole: Decimal) -> float:
    return round(float(part / whole * 100), 1) if whole else 0.0


@router.get("/analytics/summary")
def analytics_summary(
    days: int = Query(default=7, ge=7, le=30),
    branch_id: UUID | None = Query(default=None),
    user: User = Depends(owner_only),
    db: Session = Depends(get_db),
):
    if branch_id is not None:
        branch_for_user(db, user, branch_id)
    settings = get_settings()
    commission_rate = Decimal(str(settings.aggregator_commission_percent)) / Decimal("100")

    today = local_today()
    start_day = today - timedelta(days=days - 1)
    start, end = day_start_utc(start_day), day_start_utc(today + timedelta(days=1))
    filters = [
        Order.restaurant_id == user.restaurant_id,
        Order.status == "COMPLETED",
        Order.ordered_at >= start,
        Order.ordered_at < end,
    ]
    if branch_id is not None:
        filters.append(Order.branch_id == branch_id)
    orders = db.scalars(
        select(Order)
        .options(
            selectinload(Order.order_items)
            .selectinload(OrderItem.menu_item)
            .selectinload(MenuItem.ingredients)
            .selectinload(MenuItemIngredient.inventory_item)
        )
        .where(*filters)
    ).all()

    zero = Decimal("0")
    by_day = {start_day + timedelta(days=offset): {"revenue": zero, "food_cost": zero, "fees": zero, "orders": 0} for offset in range(days)}
    dish_totals: dict[UUID, dict] = {}
    total_revenue = food_cost = platform_fees = zero

    for order in orders:
        day = by_day.get(local_date(order.ordered_at))
        fee = order.total_amount * commission_rate if order.order_source in AGGREGATOR_SOURCES else zero
        order_food_cost = zero
        for order_item in order.order_items:
            menu_item = order_item.menu_item
            line_cost = recipe_cost(menu_item, order.branch_id) * order_item.quantity
            order_food_cost += line_cost
            dish = dish_totals.setdefault(menu_item.id, {"name": menu_item.name, "revenue": zero, "orders": 0, "food_cost": zero})
            dish["revenue"] += order_item.total_price
            dish["orders"] += order_item.quantity
            dish["food_cost"] += line_cost
        total_revenue += order.total_amount
        food_cost += order_food_cost
        platform_fees += fee
        if day is not None:
            day["revenue"] += order.total_amount
            day["food_cost"] += order_food_cost
            day["fees"] += fee
            day["orders"] += 1

    wastage = wastage_cost(db, user.restaurant_id, branch_id, start, end)
    total_cost = food_cost + platform_fees + wastage
    profit = total_revenue - total_cost

    return {
        "trend": [
            {
                "label": day.strftime("%d %b"),
                "revenue": values["revenue"],
                "profit": values["revenue"] - values["food_cost"] - values["fees"],
                "orders": values["orders"],
            }
            for day, values in by_day.items()
        ],
        "stats": {
            "total_revenue": total_revenue,
            "total_orders": len(orders),
            "profit_margin": percent(profit, total_revenue),
            "food_cost_percent": percent(food_cost, total_revenue),
        },
        "cost_breakdown": [
            {"name": "Food Cost", "amount": food_cost, "value": percent(food_cost, total_cost), "color": "#F2660D"},
            {"name": "Platform Fees", "amount": platform_fees, "value": percent(platform_fees, total_cost), "color": "#F0A93A"},
            {"name": "Wastage", "amount": wastage, "value": percent(wastage, total_cost), "color": "#C9500A"},
        ],
        "dishes": [
            {
                "name": values["name"],
                "revenue": values["revenue"],
                "orders": values["orders"],
                "margin": percent(values["revenue"] - values["food_cost"], values["revenue"]),
            }
            for values in dish_totals.values()
        ],
        "assumptions": {
            "aggregator_commission_percent": settings.aggregator_commission_percent,
            "timezone": settings.business_timezone,
            "excludes": "rent, salaries, utilities and other operating expenses",
        },
    }


# ─── Modules & subscriptions ──────────────────────────────────────────────────

MODULE_CATALOG = (
    ("WHATSAPP", "WhatsApp Ordering", "Take orders directly through WhatsApp chat.", Decimal("399.00")),
    ("AGGREGATORS", "Aggregator Management", "Sync Swiggy & Zomato orders in one place.", Decimal("599.00")),
    ("INVENTORY", "Inventory Intelligence", "Stock tracking, forecasts and reorder alerts.", Decimal("399.00")),
    ("AI_COPILOT", "AI Copilot", "Ask questions about sales, costs and stock.", Decimal("599.00")),
    ("MULTI_BRANCH", "Multi-Branch", "Manage multiple outlets from one dashboard.", Decimal("799.00")),
)


def module_catalog(db: Session) -> dict[str, RestaurantModule]:
    """The sellable modules, created on first use so a fresh database works without seeding."""
    modules = {module.code: module for module in db.scalars(select(RestaurantModule)).all()}
    missing = [entry for entry in MODULE_CATALOG if entry[0] not in modules]
    if missing:
        for code, name, description, price in missing:
            modules[code] = RestaurantModule(code=code, name=name, description=description, price=price)
            db.add(modules[code])
        db.commit()
    return modules


def subscription_response(subscription: Subscription) -> SubscriptionResponse:
    return SubscriptionResponse(
        id=subscription.id,
        module_id=subscription.module_id,
        module_code=subscription.module.code,
        module_name=subscription.module.name,
        status=subscription.status,
        start_date=subscription.start_date,
        end_date=subscription.end_date,
    )


def restaurant_subscriptions(db: Session, restaurant_id: UUID) -> list[Subscription]:
    return db.scalars(
        select(Subscription)
        .options(selectinload(Subscription.module))
        .where(Subscription.restaurant_id == restaurant_id)
        .order_by(Subscription.start_date)
    ).all()


@router.get("/modules", response_model=list[dict])
def list_modules(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    modules = sorted(module_catalog(db).values(), key=lambda module: module.name)
    return [{"id": m.id, "name": m.name, "code": m.code, "description": m.description, "price": m.price} for m in modules]


@router.get("/subscriptions", response_model=list[SubscriptionResponse])
def list_subscriptions(user: User = Depends(owner_only), db: Session = Depends(get_db)):
    return [subscription_response(subscription) for subscription in restaurant_subscriptions(db, user.restaurant_id)]


@router.put("/subscriptions", response_model=list[SubscriptionResponse])
def update_subscriptions(payload: SubscriptionUpdate, user: User = Depends(owner_only), db: Session = Depends(get_db)):
    """Set which modules are active. Online payment isn't connected, so nothing is charged."""
    catalog = module_catalog(db)
    wanted = {code.strip().upper() for code in payload.module_codes}
    unknown = sorted(wanted - catalog.keys())
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown module(s): {', '.join(unknown)}")

    now = datetime.now(timezone.utc)
    existing = {subscription.module.code: subscription for subscription in restaurant_subscriptions(db, user.restaurant_id)}
    for code, module in catalog.items():
        subscription = existing.get(code)
        if code in wanted:
            if subscription is None:
                db.add(Subscription(restaurant_id=user.restaurant_id, module_id=module.id, status="ACTIVE", start_date=now))
            elif subscription.status != "ACTIVE":
                subscription.status, subscription.start_date, subscription.end_date = "ACTIVE", now, None
        elif subscription is not None and subscription.status == "ACTIVE":
            subscription.status, subscription.end_date = "CANCELLED", now
    db.commit()
    return [subscription_response(subscription) for subscription in restaurant_subscriptions(db, user.restaurant_id)]


# ─── Dashboard ────────────────────────────────────────────────────────────────

def dashboard_insight(open_orders: int, ready_orders: int, low_stock: int, revenue_today: Decimal, revenue_same_time_yesterday: Decimal) -> str:
    parts = []
    if open_orders:
        parts.append(f"{open_orders} order{'s' if open_orders != 1 else ''} in the kitchen right now")
    if ready_orders:
        parts.append(f"{ready_orders} ready and waiting for pickup or payment")
    if low_stock:
        parts.append(f"{low_stock} ingredient{'s are' if low_stock != 1 else ' is'} at or below safety stock")
    if revenue_same_time_yesterday:
        change = (revenue_today - revenue_same_time_yesterday) / revenue_same_time_yesterday * 100
        parts.append(f"completed revenue is {abs(change):.0f}% {'ahead of' if change >= 0 else 'behind'} yesterday at this time")
    if not parts:
        return "All quiet: no open tickets and stock is above safety levels."
    summary = "; ".join(parts)
    return summary[0].upper() + summary[1:] + "."


@router.get("/dashboard/summary")
def dashboard_summary(user: User = Depends(owner_only), db: Session = Depends(get_db)):
    today = local_today()
    now = datetime.now(timezone.utc)
    chart_start = today - timedelta(days=6)
    week_orders = db.scalars(
        select(Order).where(
            Order.restaurant_id == user.restaurant_id,
            Order.ordered_at >= day_start_utc(chart_start),
            Order.ordered_at < day_start_utc(today + timedelta(days=1)),
        )
    ).all()

    zero = Decimal("0")
    series = {chart_start + timedelta(days=offset): {"revenue": zero, "orders": 0} for offset in range(7)}
    today_orders = []
    yesterday = today - timedelta(days=1)
    same_time_yesterday = now - timedelta(days=1)
    revenue_by_now_yesterday = zero
    for order in week_orders:
        day = local_date(order.ordered_at)
        if day == today:
            today_orders.append(order)
        if order.status == "COMPLETED" and day in series:
            series[day]["revenue"] += order.total_amount
            series[day]["orders"] += 1
            ordered_at = order.ordered_at if order.ordered_at.tzinfo else order.ordered_at.replace(tzinfo=timezone.utc)
            if day == yesterday and ordered_at <= same_time_yesterday:
                revenue_by_now_yesterday += order.total_amount

    completed_today = [order for order in today_orders if order.status == "COMPLETED"]
    today_revenue = sum((order.total_amount for order in completed_today), zero)
    open_orders = db.scalar(
        select(func.count()).select_from(Order).where(
            Order.restaurant_id == user.restaurant_id,
            Order.status.in_(("PENDING", "CONFIRMED", "PREPARING")),
        )
    ) or 0
    ready_orders = db.scalar(
        select(func.count()).select_from(Order).where(Order.restaurant_id == user.restaurant_id, Order.status == "READY")
    ) or 0
    low_stock = db.scalar(
        select(func.count()).select_from(InventoryItem).join(Branch).where(
            Branch.restaurant_id == user.restaurant_id,
            InventoryItem.is_active.is_(True),
            InventoryItem.current_stock <= InventoryItem.safety_stock_level,
        )
    ) or 0

    recent = db.scalars(
        select(Order)
        .options(selectinload(Order.order_items).selectinload(OrderItem.menu_item), selectinload(Order.branch))
        .where(Order.restaurant_id == user.restaurant_id)
        .order_by(Order.ordered_at.desc())
        .limit(8)
    ).all()
    recent_orders = [
        {
            "id": str(o.id),
            "display_id": str(o.id)[:8],
            "source": o.order_source,
            "order_type": o.order_type,
            "status": o.status,
            "total": float(o.total_amount),
            "ordered_at": o.ordered_at.isoformat(),
            "branch_name": o.branch.address if o.branch else None,
            "item_summary": ", ".join(f"{item.quantity}x {item.menu_item.name}" for item in o.order_items if item.menu_item),
            "items_count": sum(item.quantity for item in o.order_items),
        }
        for o in recent
    ]

    return {
        "today_revenue": today_revenue,
        "today_orders": sum(1 for order in today_orders if order.status != "CANCELLED"),
        "today_completed_orders": len(completed_today),
        "avg_order_value": today_revenue / len(completed_today) if completed_today else zero,
        "low_stock_count": low_stock,
        "open_orders": open_orders,
        "total_revenue": sum((values["revenue"] for values in series.values()), zero),
        "revenue_series": [
            {"day": day.isoformat(), "label": day.strftime("%a"), "revenue": values["revenue"], "orders": values["orders"]}
            for day, values in series.items()
        ],
        "recent_orders": recent_orders,
        "insight": dashboard_insight(open_orders, ready_orders, low_stock, today_revenue, revenue_by_now_yesterday),
    }


# ─── Forecast-driven reorder alerts ───────────────────────────────────────────

@router.get("/inventory/reorder-alerts")
def get_reorder_alerts(
    branch_id: UUID = Query(...),
    horizon_days: int = Query(default=30, ge=7, le=90),
    user: User = Depends(owner_only),
    db: Session = Depends(get_db),
):
    """Forecast ingredient usage for a branch and return prioritised reorder suggestions."""
    branch_for_user(db, user, branch_id)
    try:
        from app.ml.forecaster import generate_reorder_alerts
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Forecasting dependencies (xgboost, pandas) are not installed.",
        ) from exc
    try:
        return generate_reorder_alerts(db, branch_id, user.restaurant_id, horizon_days=horizon_days)
    except Exception as exc:
        logger.exception("Forecaster error")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The reorder forecast could not be generated. Check the server logs for details.",
        ) from exc


# ─── Staff & Roles Management ─────────────────────────────────────────────────

@router.get("/staff", response_model=list[StaffMemberResponse])
def list_staff(user: User = Depends(owner_only), db: Session = Depends(get_db)):
    """List all staff members and roles for the owner's restaurant."""
    return db.scalars(
        select(User)
        .where(User.restaurant_id == user.restaurant_id)
        .order_by(User.created_at.asc())
    ).all()


@router.post("/staff", response_model=StaffMemberResponse, status_code=status.HTTP_201_CREATED)
def create_staff_member(payload: StaffMemberCreate, user: User = Depends(owner_only), db: Session = Depends(get_db)):
    """Link a Supabase login to this restaurant as a staff member.

    Never moves a user who already belongs to another restaurant.
    """
    forbid_in_demo(user.restaurant_id, "Adding staff")
    existing = db.get(User, payload.user_id)
    if existing is not None:
        if existing.restaurant_id != user.restaurant_id:
            raise HTTPException(status_code=409, detail="This login already belongs to another Rasoi Saathi workspace.")
        existing.name = payload.name
        existing.role = payload.role
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return existing

    same_email = db.scalar(select(User).where(func.lower(User.email) == payload.email))
    if same_email is not None:
        if same_email.restaurant_id == user.restaurant_id:
            raise HTTPException(status_code=409, detail=f"{payload.email} is already on your team.")
        raise HTTPException(status_code=409, detail="This email already belongs to another Rasoi Saathi workspace.")

    new_user = User(
        id=payload.user_id,
        restaurant_id=user.restaurant_id,
        email=payload.email,
        name=payload.name,
        role=payload.role,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.patch("/staff/{staff_id}", response_model=StaffMemberResponse)
def update_staff_member(
    staff_id: UUID,
    payload: StaffMemberUpdate,
    user: User = Depends(owner_only),
    db: Session = Depends(get_db),
):
    """Update role, name, or active status for a staff member."""
    forbid_in_demo(user.restaurant_id, "Changing staff")
    staff = db.scalar(
        select(User).where(User.id == staff_id, User.restaurant_id == user.restaurant_id)
    )
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff member not found")

    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    if staff.id == user.id and (changes.get("is_active") is False or changes.get("role", "owner") != "owner"):
        raise HTTPException(status_code=400, detail="You can't remove your own owner access.")

    for field, value in changes.items():
        setattr(staff, field, value)

    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/staff/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_staff_member(
    staff_id: UUID,
    user: User = Depends(owner_only),
    db: Session = Depends(get_db),
):
    """Remove a staff member from the restaurant."""
    forbid_in_demo(user.restaurant_id, "Removing staff")
    if staff_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own owner account")

    staff = db.scalar(
        select(User).where(User.id == staff_id, User.restaurant_id == user.restaurant_id)
    )
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff member not found")

    db.delete(staff)
    db.commit()
