from datetime import datetime, time, timedelta, timezone
from decimal import Decimal

import pytest
from conftest import auth
from twilio.request_validator import RequestValidator

from app.main import app
from app.models import Order, OrderItem
from app.services.reporting import business_tz, local_today
from app.services.whatsapp_bot import is_menu_request, validated_order_items


def add_order(session_factory, world, status, amount, when, source="POS", quantity=1, branch=None):
    with session_factory() as db:
        order = Order(restaurant_id=world.rest_a, branch_id=branch or world.central, order_source=source, order_type="DINE_IN",
                      status=status, total_amount=Decimal(amount), ordered_at=when)
        db.add(order)
        db.flush()
        db.add(OrderItem(order_id=order.id, menu_item_id=world.biryani, quantity=quantity, unit_price=Decimal("260"), total_price=Decimal(amount)))
        db.commit()


def local_noon_utc(days_ago=0):
    return datetime.combine(local_today() - timedelta(days=days_ago), time(12, 0), tzinfo=business_tz()).astimezone(timezone.utc)


def test_dashboard_revenue_counts_completed_orders_only(client, world, session_factory):
    add_order(session_factory, world, "COMPLETED", "260", local_noon_utc())
    add_order(session_factory, world, "CANCELLED", "5000", local_noon_utc())
    add_order(session_factory, world, "PENDING", "520", local_noon_utc())
    body = client.get("/api/dashboard/summary", headers=auth(world.owner_a)).json()
    assert Decimal(str(body["today_revenue"])) == Decimal("260")
    assert body["today_orders"] == 2  # cancelled excluded, pending included
    assert body["open_orders"] == 1
    assert Decimal(str(body["revenue_series"][-1]["revenue"])) == Decimal("260")


def test_early_morning_orders_count_on_the_local_business_day(client, world, session_factory):
    # 00:30 IST today is 19:00 UTC yesterday; it must still count as today.
    just_after_midnight = datetime.combine(local_today(), time(0, 30), tzinfo=business_tz()).astimezone(timezone.utc)
    add_order(session_factory, world, "COMPLETED", "260", just_after_midnight)
    body = client.get("/api/dashboard/summary", headers=auth(world.owner_a)).json()
    assert Decimal(str(body["today_revenue"])) == Decimal("260")


def test_analytics_uses_only_the_selling_branchs_recipe_cost(client, world, session_factory):
    add_order(session_factory, world, "COMPLETED", "260", local_noon_utc())
    body = client.get("/api/analytics/summary?days=7", headers=auth(world.owner_a)).json()
    biryani = next(d for d in body["dishes"] if d["name"] == "Chicken Biryani")
    assert biryani["margin"] == pytest.approx((260 - 0.5 * 92) / 260 * 100, abs=0.1)
    assert body["stats"]["total_orders"] == 1


def test_analytics_charges_commission_on_aggregator_orders(client, world, session_factory):
    add_order(session_factory, world, "COMPLETED", "1000", local_noon_utc(), source="SWIGGY", quantity=1)
    body = client.get("/api/analytics/summary?days=7", headers=auth(world.owner_a)).json()
    fees = next(c for c in body["cost_breakdown"] if c["name"] == "Platform Fees")
    assert Decimal(str(fees["amount"])) == Decimal("200")
    assert body["trend"][-1]["profit"] == pytest.approx(1000 - 46 - 200)


def test_unhandled_errors_keep_cors_headers(client):
    def boom():
        raise RuntimeError("boom")

    app.add_api_route("/__test_boom", boom)
    try:
        response = client.get("/__test_boom", headers={"Origin": "http://localhost:3000"})
    finally:
        app.router.routes = [route for route in app.router.routes if getattr(route, "path", None) != "/__test_boom"]
    assert response.status_code == 500
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert response.json()["detail"].startswith("An unexpected server error")


@pytest.mark.parametrize(
    ("origin", "allowed"),
    [("http://localhost:3000", True), ("http://localhost:3001", True), ("http://127.0.0.1:3005", True), ("https://evil.example", False)],
)
def test_cors_allows_any_local_dev_port_only(client, origin, allowed):
    response = client.options(
        "/api/auth/me",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization"},
    )
    assert (response.headers.get("access-control-allow-origin") == origin) is allowed


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        ("hi", True),
        ("Hello!", True),
        ("send me the menu please", True),
        ("MENU", True),
        ("2 Paneer Tikka starters please", False),
        ("1 cardamom chai", False),
        ("one chicken biryani, packed with a list of extras", False),
        ("what dishes do you have", False),  # goes to the parser, which can answer with the menu
    ],
)
def test_menu_keywords_do_not_swallow_orders(message, expected):
    assert is_menu_request(message) is expected


def test_gemini_output_is_validated(world, session_factory):
    from app.models import MenuItem

    with session_factory() as db:
        menu = db.query(MenuItem).all()
    biryani_id = str(world.biryani)
    parsed = {
        "items": [
            {"menu_item_id": biryani_id, "quantity": "two"},
            {"menu_item_id": biryani_id, "quantity": 1000},
            {"menu_item_id": "not-on-the-menu", "quantity": 1},
            "junk",
        ]
    }
    items = validated_order_items(parsed, menu)
    assert [(item.name, quantity) for item, quantity in items] == [("Chicken Biryani", 50)]
    assert validated_order_items({"items": None}, menu) == []


def test_simulator_is_owner_only_and_scoped_to_the_owners_restaurant(client, world):
    assert client.post("/api/whatsapp/simulate", json={"message": "hi"}).status_code == 401
    assert client.post("/api/whatsapp/simulate", json={"message": "hi"}, headers=auth(world.waiter_a)).status_code == 403
    reply = client.post("/api/whatsapp/simulate", json={"message": "hi"}, headers=auth(world.owner_b)).json()["reply"]
    assert "Curry House" in reply and "Saffron Junction" not in reply


def test_webhook_rejects_requests_without_a_valid_twilio_signature(client, world, settings, monkeypatch):
    monkeypatch.setattr(settings, "twilio_auth_token", "twilio-test-token")
    form = {"From": "whatsapp:+919800000000", "Body": "menu", "ProfileName": "Test"}
    url = "http://testserver/api/whatsapp/webhook"

    forged = client.post("/api/whatsapp/webhook", data=form, headers={"X-Twilio-Signature": "forged"})
    assert forged.status_code == 403

    signature = RequestValidator("twilio-test-token").compute_signature(url, form)
    genuine = client.post("/api/whatsapp/webhook", data=form, headers={"X-Twilio-Signature": signature})
    assert genuine.status_code == 200
    assert "<Response>" in genuine.text
    # Two restaurants share the number and this customer hasn't picked one: ask instead of guessing.
    assert "Which restaurant" in genuine.text


def test_webhook_refuses_to_run_unverified_when_token_missing(client, settings, monkeypatch):
    monkeypatch.setattr(settings, "twilio_auth_token", "")
    response = client.post("/api/whatsapp/webhook", data={"From": "whatsapp:+919800000000", "Body": "hi"})
    assert response.status_code == 503
