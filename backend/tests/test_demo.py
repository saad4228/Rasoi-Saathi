from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from conftest import auth

from app.demo import DEMO_ACCOUNTS, DEMO_RESTAURANT_ID
from app.models import Branch, MenuItem, Order, Restaurant, User
from app.routers.demo import reset_cache
from app.routers.operations import module_catalog
from app.services.demo_workspace import build_demo, wait_for_demo_refresh, wipe_demo

LOGINS = {role: uuid4() for role, _, _ in DEMO_ACCOUNTS}


@pytest.fixture()
def demo(session_factory):
    with session_factory() as db:
        module_ids = [module.id for module in module_catalog(db).values()]
    with session_factory() as db:
        wipe_demo(db, list(LOGINS.values()))
        build_demo(db, LOGINS, module_ids)
        db.commit()
    return module_ids


def test_demo_accounts_are_hidden_until_the_demo_exists(client, world):
    assert client.get("/api/demo/accounts").json() == {"available": False, "accounts": []}


def test_demo_accounts_endpoint_lists_the_logins(client, demo, settings):
    body = client.get("/api/demo/accounts").json()
    assert body["available"] is True
    assert body["password"] == settings.demo_password
    assert [(a["role"], a["email"]) for a in body["accounts"]] == [(role, email) for role, _, email in DEMO_ACCOUNTS]


def test_demo_workspace_has_realistic_data_and_logins(client, demo, session_factory):
    me = client.get("/api/auth/me", headers=auth(LOGINS["owner"])).json()
    assert me["is_demo"] is True and me["restaurant_name"] == "Saffron Junction"
    assert client.get("/api/auth/me", headers=auth(LOGINS["chef"])).json()["role"] == "chef"

    dashboard = client.get("/api/dashboard/summary", headers=auth(LOGINS["owner"])).json()
    assert dashboard["open_orders"] >= 5 and dashboard["low_stock_count"] >= 2
    analytics = client.get("/api/analytics/summary?days=30", headers=auth(LOGINS["owner"])).json()
    assert analytics["stats"]["total_orders"] > 300
    assert next(c for c in analytics["cost_breakdown"] if c["name"] == "Wastage")["amount"] != 0

    with session_factory() as db:
        central = db.query(Branch).filter_by(restaurant_id=DEMO_RESTAURANT_ID, address="12 Central Market, Nagpur").one()
    kitchen = client.get(f"/api/orders?branch_id={central.id}&status=READY", headers=auth(LOGINS["waiter"])).json()
    assert len(kitchen) == 2


def test_reseeding_resets_the_demo_without_duplicates(client, demo, session_factory):
    # A visitor changes things...
    dish = client.get("/api/menu-items", headers=auth(LOGINS["owner"])).json()[0]
    client.patch(f"/api/menu-items/{dish['id']}", json={"price": 1}, headers=auth(LOGINS["owner"]))
    with session_factory() as db:
        counts_before = (db.query(MenuItem).count(), db.query(Branch).count(), db.query(User).count())

    with session_factory() as db:
        wipe_demo(db, list(LOGINS.values()))
        build_demo(db, LOGINS, demo)
        db.commit()

    with session_factory() as db:
        assert (db.query(MenuItem).count(), db.query(Branch).count(), db.query(User).count()) == counts_before
        assert all(item.price > 1 for item in db.query(MenuItem).all())
        assert db.query(Order).filter(Order.restaurant_id == DEMO_RESTAURANT_ID).count() > 300


def test_stale_demo_rebuilds_itself_when_the_login_page_loads(client, demo, session_factory):
    owner = auth(LOGINS["owner"])
    # A visitor serves every live ticket, and the demo is from yesterday.
    for order in client.get("/api/orders?status=PENDING", headers=owner).json():
        client.patch(f"/api/orders/{order['id']}", json={"status": "CANCELLED"}, headers=owner)
    with session_factory() as db:
        live_before = db.query(Order).filter(Order.restaurant_id == DEMO_RESTAURANT_ID, Order.status == "PENDING").count()
        db.get(Restaurant, DEMO_RESTAURANT_ID).created_at = datetime.now(timezone.utc) - timedelta(days=1)
        db.commit()

    assert client.get("/api/demo/accounts").json()["available"] is True
    wait_for_demo_refresh()  # the rebuild runs on its own thread, detached from the request

    with session_factory() as db:
        built_at = db.get(Restaurant, DEMO_RESTAURANT_ID).created_at
        assert datetime.now(timezone.utc) - built_at.replace(tzinfo=built_at.tzinfo or timezone.utc) < timedelta(minutes=1)
        assert db.query(Order).filter(Order.restaurant_id == DEMO_RESTAURANT_ID, Order.status == "PENDING").count() == 3 != live_before
        assert db.query(User).filter(User.restaurant_id == DEMO_RESTAURANT_ID).count() == 3
    # The same logins keep working after the rebuild.
    assert client.get("/api/auth/me", headers=owner).json()["is_demo"] is True
    # A fresh demo is left alone.
    with session_factory() as db:
        order_ids = {o.id for o in db.query(Order).filter(Order.restaurant_id == DEMO_RESTAURANT_ID)}
    reset_cache()  # the answer is cached, and this assertion is about the rebuild clock
    client.get("/api/demo/accounts")
    wait_for_demo_refresh()
    with session_factory() as db:
        assert {o.id for o in db.query(Order).filter(Order.restaurant_id == DEMO_RESTAURANT_ID)} == order_ids


def test_demo_blocks_changes_that_would_break_it_for_the_next_visitor(client, demo, session_factory):
    owner = auth(LOGINS["owner"])
    with session_factory() as db:
        branch_id = db.query(Branch).filter_by(restaurant_id=DEMO_RESTAURANT_ID).first().id
    blocked = [
        client.post("/api/staff", json={"user_id": str(uuid4()), "name": "x", "email": "x@example.com", "role": "chef"}, headers=owner),
        client.patch(f"/api/staff/{LOGINS['chef']}", json={"is_active": False}, headers=owner),
        client.delete(f"/api/staff/{LOGINS['waiter']}", headers=owner),
        client.post("/api/branches", json={"address": "New"}, headers=owner),
        client.patch(f"/api/branches/{branch_id}", json={"is_active": False}, headers=owner),
        client.post("/api/customers/resolve", json={"phone": "+919999999999"}, headers=owner),
        client.post("/api/whatsapp/simulate", json={"message": "2 chicken biryani"}, headers=owner),
    ]
    assert [r.status_code for r in blocked] == [403] * len(blocked)
    assert "demo workspace" in blocked[0].json()["detail"]
    # Everyday actions still work.
    dish = client.get("/api/menu-items", headers=owner).json()[0]
    assert client.patch(f"/api/menu-items/{dish['id']}", json={"is_active": False}, headers=owner).status_code == 200


def test_real_workspaces_are_not_affected(client, world):
    me = client.get("/api/auth/me", headers=auth(world.owner_a)).json()
    assert me["is_demo"] is False
    assert client.post("/api/branches", json={"address": "New"}, headers=auth(world.owner_a)).status_code == 201
