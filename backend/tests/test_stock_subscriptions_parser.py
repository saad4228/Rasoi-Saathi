from decimal import Decimal
from uuid import uuid4

import pytest
from conftest import auth

from app.models import Customer, InventoryItem, InventoryTransaction, MenuItem, Order, Subscription
from app.services.whatsapp_bot import parse_order_locally


def transactions(session_factory, item_id):
    with session_factory() as db:
        return [(t.transaction_type, t.quantity) for t in db.query(InventoryTransaction).filter_by(inventory_item_id=item_id).order_by(InventoryTransaction.created_at)]


# ─── Stock movements & archiving ──────────────────────────────────────────────

def test_receiving_stock_adds_quantity_updates_cost_and_logs_it(client, world, session_factory):
    response = client.post(
        f"/api/inventory-items/{world.rice_central}/movements",
        json={"type": "PURCHASE", "quantity": 5, "unit_cost": 95},
        headers=auth(world.owner_a),
    )
    assert response.status_code == 200
    assert Decimal(response.json()["current_stock"]) == Decimal("15")
    assert Decimal(response.json()["cost_per_unit"]) == Decimal("95")
    assert transactions(session_factory, world.rice_central) == [("PURCHASE", Decimal("5"))]


def test_wastage_is_capped_at_stock_on_hand(client, world, session_factory):
    response = client.post(f"/api/inventory-items/{world.rice_central}/movements", json={"type": "WASTE", "quantity": 25}, headers=auth(world.owner_a))
    assert response.status_code == 200
    assert Decimal(response.json()["current_stock"]) == Decimal("0")
    assert transactions(session_factory, world.rice_central) == [("WASTE", Decimal("-10"))]
    again = client.post(f"/api/inventory-items/{world.rice_central}/movements", json={"type": "WASTE", "quantity": 1}, headers=auth(world.owner_a))
    assert again.status_code == 409


def test_only_owners_record_movements(client, world):
    response = client.post(f"/api/inventory-items/{world.rice_central}/movements", json={"type": "PURCHASE", "quantity": 1}, headers=auth(world.chef_a))
    assert response.status_code == 403


def test_editing_stock_count_is_recorded_as_an_adjustment(client, world, session_factory):
    client.patch(f"/api/inventory-items/{world.rice_central}", json={"current_stock": 7.5}, headers=auth(world.owner_a))
    client.patch(f"/api/inventory-items/{world.rice_central}", json={"safety_stock_level": 2}, headers=auth(world.owner_a))
    assert transactions(session_factory, world.rice_central) == [("ADJUSTMENT", Decimal("-2.5"))]


def test_wastage_shows_up_in_analytics(client, world):
    client.post(f"/api/inventory-items/{world.rice_central}/movements", json={"type": "WASTE", "quantity": 2}, headers=auth(world.owner_a))
    body = client.get("/api/analytics/summary?days=7", headers=auth(world.owner_a)).json()
    wastage = next(c for c in body["cost_breakdown"] if c["name"] == "Wastage")
    assert Decimal(str(wastage["amount"])) == Decimal("184")  # 2 kg x ₹92


def test_items_with_history_are_archived_not_deleted(client, world, session_factory):
    client.post(f"/api/inventory-items/{world.rice_central}/movements", json={"type": "PURCHASE", "quantity": 1}, headers=auth(world.owner_a))
    assert client.delete(f"/api/inventory-items/{world.rice_central}", headers=auth(world.owner_a)).status_code == 204

    listed = [item["id"] for item in client.get("/api/inventory-items", headers=auth(world.owner_a)).json()]
    assert str(world.rice_central) not in listed
    with session_factory() as db:
        archived = db.get(InventoryItem, world.rice_central)
        assert archived is not None and archived.is_active is False
    assert transactions(session_factory, world.rice_central) == [("PURCHASE", Decimal("1"))]

    # Archived stock can't be put back into recipes, and its name can be reused.
    recipe = client.post(
        "/api/menu-items",
        json={"branch_id": str(world.central), "name": "Pulao", "price": 150, "ingredients": [{"inventory_item_id": str(world.rice_central), "quantity_per_unit": 0.2}]},
        headers=auth(world.owner_a),
    )
    assert recipe.status_code == 422
    reused = client.post(
        "/api/inventory-items",
        json={"branch_id": str(world.central), "name": "Basmati Rice", "unit": "kg", "cost_per_unit": 92},
        headers=auth(world.owner_a),
    )
    assert reused.status_code == 201


def test_unused_items_are_deleted_outright(client, world, session_factory):
    created = client.post(
        "/api/inventory-items",
        json={"branch_id": str(world.central), "name": "Saffron", "unit": "g", "cost_per_unit": 300},
        headers=auth(world.owner_a),
    ).json()
    assert client.delete(f"/api/inventory-items/{created['id']}", headers=auth(world.owner_a)).status_code == 204
    with session_factory() as db:
        assert db.query(InventoryItem).filter_by(name="Saffron").count() == 0


# ─── Subscriptions ────────────────────────────────────────────────────────────

def test_modules_catalog_exists_without_seeding(client, world):
    codes = {module["code"] for module in client.get("/api/modules", headers=auth(world.waiter_a)).json()}
    assert codes == {"WHATSAPP", "AGGREGATORS", "INVENTORY", "AI_COPILOT", "MULTI_BRANCH"}


def test_owner_can_save_and_change_their_plan(client, world, session_factory):
    assert client.get("/api/subscriptions", headers=auth(world.owner_a)).json() == []

    saved = client.put("/api/subscriptions", json={"module_codes": ["WHATSAPP", "inventory"]}, headers=auth(world.owner_a))
    assert saved.status_code == 200
    assert {s["module_code"] for s in saved.json() if s["status"] == "ACTIVE"} == {"WHATSAPP", "INVENTORY"}

    changed = client.put("/api/subscriptions", json={"module_codes": ["AI_COPILOT", "WHATSAPP"]}, headers=auth(world.owner_a)).json()
    status_by_code = {s["module_code"]: s["status"] for s in changed}
    assert status_by_code == {"WHATSAPP": "ACTIVE", "INVENTORY": "CANCELLED", "AI_COPILOT": "ACTIVE"}

    reactivated = client.put("/api/subscriptions", json={"module_codes": ["INVENTORY"]}, headers=auth(world.owner_a)).json()
    assert {s["module_code"] for s in reactivated if s["status"] == "ACTIVE"} == {"INVENTORY"}
    with session_factory() as db:
        assert db.query(Subscription).filter_by(restaurant_id=world.rest_a).count() == 3  # rows reused, not duplicated
    assert client.get("/api/subscriptions", headers=auth(world.owner_b)).json() == []


def test_plan_changes_are_validated_and_owner_only(client, world):
    assert client.put("/api/subscriptions", json={"module_codes": ["TELEPORT"]}, headers=auth(world.owner_a)).status_code == 422
    assert client.put("/api/subscriptions", json={"module_codes": ["WHATSAPP"]}, headers=auth(world.chef_a)).status_code == 403


# ─── Onboarding race, background WhatsApp alert ───────────────────────────────

def test_onboarding_twice_returns_the_same_workspace(client):
    user_id = uuid4()
    first = client.post("/api/auth/onboarding", json={"restaurant_name": "Dosa Point"}, headers=auth(user_id, "asha@example.com")).json()
    second = client.post("/api/auth/onboarding", json={"restaurant_name": "Dosa Point"}, headers=auth(user_id, "asha@example.com")).json()
    assert first["restaurant_id"] == second["restaurant_id"]


def test_ready_alert_is_sent_to_whatsapp_customers(client, world, session_factory, monkeypatch):
    sent = []
    monkeypatch.setattr("app.services.whatsapp_bot.send_whatsapp_order_ready_notification", lambda **message: sent.append(message))
    with session_factory() as db:
        customer = Customer(restaurant_id=world.rest_a, phone="+919800000001", name="Meera")
        db.add(customer)
        db.commit()
        customer_id = customer.id
    order = client.post(
        "/api/orders",
        json={"branch_id": str(world.central), "customer_id": str(customer_id), "items": [{"menu_item_id": str(world.lassi), "quantity": 2}]},
        headers=auth(world.waiter_a),
    ).json()
    response = client.patch(f"/api/orders/{order['id']}", json={"status": "READY"}, headers=auth(world.chef_a))
    assert response.status_code == 200
    assert response.json()["customer_name"] == "Meera"
    assert len(sent) == 1 and sent[0]["customer_phone"] == "+919800000001" and sent[0]["items_summary"] == "2x Kesar Lassi"


# ─── Rule-based WhatsApp parser (used when Gemini is unavailable) ─────────────

@pytest.fixture()
def menu(world, session_factory):
    with session_factory() as db:
        return {item.name: str(item.id) for item in db.query(MenuItem).all()}, db.query(MenuItem).all()


@pytest.mark.parametrize(
    ("message", "expected", "order_type"),
    [
        ("2 chicken biryani and a kesar lassi for delivery", {"Chicken Biryani": 2, "Kesar Lassi": 1}, "DELIVERY"),
        ("Send two biryanis please", {"Chicken Biryani": 2}, "TAKEAWAY"),
        ("do biryani aur ek lassi", {"Chicken Biryani": 2, "Kesar Lassi": 1}, "TAKEAWAY"),
        ("kesar lassi x3, dine in", {"Kesar Lassi": 3}, "DINE_IN"),
        ("can I get 2 chicken biryani?", {"Chicken Biryani": 2}, "TAKEAWAY"),
        ("is the biryani spicy?", {}, None),
        ("do you have biryani", {}, None),
        ("hello there friend", {}, "TAKEAWAY"),
    ],
)
def test_local_parser_understands_common_orders(menu, message, expected, order_type):
    ids, items = menu
    parsed = parse_order_locally(message, items)
    by_name = {name: quantity for name, item_id in ids.items() for entry in parsed["items"] if entry["menu_item_id"] == item_id for quantity in [entry["quantity"]]}
    assert by_name == expected
    if order_type:
        assert parsed["order_type"] == order_type


def test_whatsapp_orders_work_without_gemini(client, world, session_factory):
    reply = client.post(
        "/api/whatsapp/simulate",
        json={"phone": "+919811111111", "message": "2 chicken biryani and a kesar lassi"},
        headers=auth(world.owner_a),
    ).json()["reply"]
    assert "Order Confirmed" in reply
    with session_factory() as db:
        order = db.query(Order).filter_by(order_source="WHATSAPP").one()
        assert order.total_amount == Decimal("630")
