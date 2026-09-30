from decimal import Decimal

from conftest import auth

from app.models import InventoryItem, InventoryTransaction


def place_order(client, world, branch=None, quantity=2, headers=None):
    response = client.post(
        "/api/orders",
        json={"branch_id": str(branch or world.central), "items": [{"menu_item_id": str(world.biryani), "quantity": quantity}]},
        headers=headers or auth(world.waiter_a),
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def set_status(client, order_id, status, user):
    return client.patch(f"/api/orders/{order_id}", json={"status": status}, headers=auth(user))


def stock(session_factory, item_id):
    with session_factory() as db:
        return db.get(InventoryItem, item_id).current_stock


def test_unknown_status_is_rejected(client, world):
    order_id = place_order(client, world)
    assert set_status(client, order_id, "BANANA", world.chef_a).status_code == 422


def test_status_transitions_and_roles_are_enforced(client, world):
    order_id = place_order(client, world)
    assert set_status(client, order_id, "COMPLETED", world.waiter_a).status_code == 409  # must be READY first
    assert set_status(client, order_id, "READY", world.waiter_a).status_code == 403  # kitchen marks ready
    assert set_status(client, order_id, "PREPARING", world.chef_a).status_code == 200
    assert set_status(client, order_id, "READY", world.chef_a).status_code == 200
    assert set_status(client, order_id, "COMPLETED", world.chef_a).status_code == 403  # waiter takes payment
    assert set_status(client, order_id, "COMPLETED", world.waiter_a).status_code == 200
    assert set_status(client, order_id, "PENDING", world.owner_a).status_code == 409  # completed is final


def test_ready_deducts_only_the_orders_own_branch_stock(client, world, session_factory):
    order_id = place_order(client, world, quantity=2)
    assert set_status(client, order_id, "READY", world.chef_a).status_code == 200
    assert stock(session_factory, world.rice_central) == Decimal("9")
    assert stock(session_factory, world.rice_riverside) == Decimal("10")
    with session_factory() as db:
        transactions = db.query(InventoryTransaction).all()
        assert [(t.inventory_item_id, t.branch_id) for t in transactions] == [(world.rice_central, world.central)]


def test_stock_is_deducted_once_even_if_ready_is_repeated(client, world, session_factory):
    order_id = place_order(client, world, quantity=2)
    set_status(client, order_id, "READY", world.chef_a)
    set_status(client, order_id, "PREPARING", world.chef_a)
    set_status(client, order_id, "READY", world.chef_a)
    assert stock(session_factory, world.rice_central) == Decimal("9")


def test_low_recorded_stock_warns_but_does_not_block_the_kitchen(client, world, session_factory):
    order_id = place_order(client, world, quantity=30)  # needs 15 kg, only 10 recorded
    response = set_status(client, order_id, "READY", world.chef_a)
    assert response.status_code == 200
    assert response.json()["status"] == "READY"
    assert "Basmati Rice" in response.json()["inventory_warnings"][0]
    assert stock(session_factory, world.rice_central) == Decimal("0")


def test_orders_respect_branch_service_types_and_active_state(client, world):
    client.patch(f"/api/branches/{world.riverside}", json={"supports_delivery": False}, headers=auth(world.owner_a))
    delivery = client.post(
        "/api/orders",
        json={"branch_id": str(world.riverside), "order_type": "DELIVERY", "items": [{"menu_item_id": str(world.lassi), "quantity": 1}]},
        headers=auth(world.waiter_a),
    )
    assert delivery.status_code == 422
    client.patch(f"/api/branches/{world.riverside}", json={"is_active": False}, headers=auth(world.owner_a))
    dine_in = client.post(
        "/api/orders",
        json={"branch_id": str(world.riverside), "items": [{"menu_item_id": str(world.lassi), "quantity": 1}]},
        headers=auth(world.waiter_a),
    )
    assert dine_in.status_code == 409


def test_order_list_filters(client, world):
    place_order(client, world, branch=world.central)
    place_order(client, world, branch=world.riverside)
    everything = client.get("/api/orders", headers=auth(world.chef_a)).json()
    central_only = client.get(f"/api/orders?branch_id={world.central}", headers=auth(world.chef_a)).json()
    future = client.get("/api/orders?since=2999-01-01T00:00:00Z", headers=auth(world.chef_a)).json()
    assert len(everything) == 2 and len(central_only) == 1 and future == []
    assert client.get("/api/orders", headers=auth(world.owner_b)).json() == []


def test_create_dish_returns_201_with_its_branch_recipe(client, world):
    response = client.post(
        "/api/menu-items",
        json={
            "branch_id": str(world.central),
            "name": "Veg Pulao",
            "price": 180,
            "ingredients": [{"inventory_item_id": str(world.rice_central), "quantity_per_unit": 0.2}],
        },
        headers=auth(world.chef_a),
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert [(i["name"], Decimal(i["quantity_per_unit"])) for i in body["ingredients"]] == [("Basmati Rice", Decimal("0.2"))]


def test_create_dish_rejects_ingredients_from_another_branch(client, world):
    response = client.post(
        "/api/menu-items",
        json={
            "branch_id": str(world.central),
            "name": "Wrong Branch Pulao",
            "price": 180,
            "ingredients": [{"inventory_item_id": str(world.rice_riverside), "quantity_per_unit": 0.2}],
        },
        headers=auth(world.owner_a),
    )
    assert response.status_code == 422
    names = [dish["name"] for dish in client.get("/api/menu-items", headers=auth(world.owner_a)).json()]
    assert "Wrong Branch Pulao" not in names  # nothing half-saved


def test_menu_list_can_show_one_branchs_recipe(client, world):
    dishes = client.get(f"/api/menu-items?branch_id={world.central}", headers=auth(world.chef_a)).json()
    biryani = next(d for d in dishes if d["name"] == "Chicken Biryani")
    assert len(biryani["ingredients"]) == 1
    assert biryani["ingredients"][0]["branch_id"] == str(world.central)


def test_dish_with_order_history_cannot_be_deleted(client, world):
    place_order(client, world)
    response = client.delete(f"/api/menu-items/{world.biryani}", headers=auth(world.owner_a))
    assert response.status_code == 409
    assert "unavailable" in response.json()["detail"]


def test_inventory_names_are_unique_per_branch(client, world):
    duplicate = client.post(
        "/api/inventory-items",
        json={"branch_id": str(world.central), "name": "basmati rice ", "unit": "kg", "cost_per_unit": 90},
        headers=auth(world.owner_a),
    )
    other_branch = client.post(
        "/api/inventory-items",
        json={"branch_id": str(world.central), "name": "Saffron", "unit": "g", "cost_per_unit": 300},
        headers=auth(world.owner_a),
    )
    assert duplicate.status_code == 409
    assert other_branch.status_code == 201
