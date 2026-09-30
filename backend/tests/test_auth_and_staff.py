import time
from uuid import uuid4

from conftest import auth, make_token

from app.models import Branch, Restaurant, User


def test_me_returns_profile_for_valid_hs256_token(client, world):
    response = client.get("/api/auth/me", headers=auth(world.owner_a))
    assert response.status_code == 200
    assert response.json()["role"] == "owner"
    assert response.json()["restaurant_name"] == "Saffron Junction"


def test_login_without_profile_is_reported_as_profile_missing_not_bad_token(client, world):
    response = client.get("/api/auth/me", headers=auth(uuid4()))
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "profile_missing"


def test_deactivated_staff_get_a_distinct_error(client, world, session_factory):
    with session_factory() as db:
        db.get(User, world.waiter_a).is_active = False
        db.commit()
    response = client.get("/api/auth/me", headers=auth(world.waiter_a))
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "account_inactive"


def test_invalid_or_expired_tokens_are_rejected(client, world):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-jwt"}).status_code == 401
    expired = make_token(world.owner_a, exp=1)
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired}"}).status_code == 401
    wrong_audience = make_token(world.owner_a, aud="anon")
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {wrong_audience}"}).status_code == 401


def test_fresh_token_works_when_this_pc_clock_is_slightly_behind(client, world):
    # Supabase's clock a few seconds ahead of ours makes a brand-new token's `iat` look like the future.
    fresh = make_token(world.owner_a, iat=int(time.time()) + 5)
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {fresh}"}).status_code == 200
    expired_long_ago = make_token(world.owner_a, exp=int(time.time()) - 600)
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_long_ago}"}).status_code == 401


def test_onboarding_creates_restaurant_owner_and_first_branch(client, session_factory):
    new_user = uuid4()
    response = client.post(
        "/api/auth/onboarding",
        json={"restaurant_name": "Dosa Point", "owner_name": "Asha"},
        headers=auth(new_user, "asha@example.com"),
    )
    assert response.status_code == 200
    assert response.json()["role"] == "owner"
    with session_factory() as db:
        user = db.get(User, new_user)
        branches = db.query(Branch).filter(Branch.restaurant_id == user.restaurant_id).all()
        assert db.get(Restaurant, user.restaurant_id).name == "Dosa Point"
        assert [branch.address for branch in branches] == ["Main Branch"]
    # New owners can immediately use branch-scoped features.
    assert len(client.get("/api/branches", headers=auth(new_user)).json()) == 1


def test_owner_cannot_take_over_another_restaurants_user(client, world, session_factory):
    by_email = client.post(
        "/api/staff",
        json={"user_id": str(uuid4()), "name": "x", "email": "OWNER-B@example.com", "role": "waiter"},
        headers=auth(world.owner_a),
    )
    by_id = client.post(
        "/api/staff",
        json={"user_id": str(world.owner_b), "name": "x", "email": "someone@example.com", "role": "waiter"},
        headers=auth(world.owner_a),
    )
    assert by_email.status_code == 409
    assert by_id.status_code == 409
    with session_factory() as db:
        owner_b = db.get(User, world.owner_b)
        assert owner_b.restaurant_id == world.rest_b
        assert owner_b.role == "owner"


def test_owner_links_new_staff_login(client, world):
    staff_id = uuid4()
    response = client.post(
        "/api/staff",
        json={"user_id": str(staff_id), "name": "Rohan", "email": "Rohan@Example.com", "role": "chef"},
        headers=auth(world.owner_a),
    )
    assert response.status_code == 201
    assert response.json()["email"] == "rohan@example.com"
    assert client.get("/api/auth/me", headers=auth(staff_id)).json()["role"] == "chef"


def test_staff_creation_requires_the_auth_user_id(client, world):
    response = client.post("/api/staff", json={"name": "x", "email": "x@example.com", "role": "waiter"}, headers=auth(world.owner_a))
    assert response.status_code == 422


def test_owner_cannot_remove_own_owner_access(client, world):
    demote = client.patch(f"/api/staff/{world.owner_a}", json={"role": "waiter"}, headers=auth(world.owner_a))
    deactivate = client.patch(f"/api/staff/{world.owner_a}", json={"is_active": False}, headers=auth(world.owner_a))
    assert demote.status_code == 400
    assert deactivate.status_code == 400


def test_owner_only_endpoints_reject_staff(client, world):
    for path in ["/api/dashboard/summary", "/api/analytics/summary", "/api/forecasts", "/api/staff", "/api/subscriptions"]:
        assert client.get(path, headers=auth(world.waiter_a)).status_code == 403, path
        assert client.get(path, headers=auth(world.chef_a)).status_code == 403, path
    copilot = client.post("/api/copilot/chat", json={"message": "hi"}, headers=auth(world.chef_a))
    assert copilot.status_code == 403
    create_stock = client.post(
        "/api/inventory-items",
        json={"branch_id": str(world.central), "name": "Salt", "unit": "kg", "cost_per_unit": 20},
        headers=auth(world.chef_a),
    )
    assert create_stock.status_code == 403
    # Chefs still read inventory to build recipes.
    assert client.get("/api/inventory-items", headers=auth(world.chef_a)).status_code == 200


def test_branches_can_be_created_and_edited_by_owner(client, world):
    created = client.post("/api/branches", json={"address": "Airport Kiosk", "supports_dine_in": False}, headers=auth(world.owner_a))
    assert created.status_code == 201
    branch_id = created.json()["id"]
    updated = client.patch(f"/api/branches/{branch_id}", json={"phone": "+91 99999 00000", "is_active": False}, headers=auth(world.owner_a))
    assert updated.status_code == 200
    assert updated.json()["is_active"] is False
    assert client.patch(f"/api/branches/{branch_id}", json={"is_active": True}, headers=auth(world.chef_a)).status_code == 403
    assert client.patch(f"/api/branches/{branch_id}", json={"is_active": True}, headers=auth(world.owner_b)).status_code == 404
