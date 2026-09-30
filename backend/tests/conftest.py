"""Shared fixtures: an isolated SQLite database and real HS256 login tokens.

Environment variables are set before the app is imported. They take precedence
over backend/.env, so tests never touch the real database, Gemini or Twilio.
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID, uuid4

TEST_SUPABASE_URL = "https://test-project.supabase.co"
TEST_JWT_SECRET = "test-jwt-secret-for-hs256-tokens-0123456789"

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["SUPABASE_URL"] = TEST_SUPABASE_URL
os.environ["SUPABASE_JWT_SECRET"] = TEST_JWT_SECRET
os.environ["SUPABASE_JWT_ISSUER"] = f"{TEST_SUPABASE_URL}/auth/v1"
os.environ["GEMINI_API_KEY"] = ""
os.environ["TWILIO_ACCOUNT_SID"] = ""
os.environ["TWILIO_AUTH_TOKEN"] = ""
os.environ["BUSINESS_TIMEZONE"] = "Asia/Kolkata"
os.environ["AGGREGATOR_COMMISSION_PERCENT"] = "20"

import jwt  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models  # noqa: E402,F401
from app.config import get_settings  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Branch, InventoryItem, MenuItem, MenuItemIngredient, Restaurant, User  # noqa: E402


def make_token(user_id: UUID, email: str = "user@example.com", **overrides) -> str:
    claims = {
        "sub": str(user_id),
        "email": email,
        "aud": "authenticated",
        "iss": f"{TEST_SUPABASE_URL}/auth/v1",
        "exp": int(time.time()) + 3600,
        **overrides,
    }
    return jwt.encode(claims, TEST_JWT_SECRET, algorithm="HS256")


def auth(user_id: UUID, email: str = "user@example.com") -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(user_id, email)}"}


@dataclass
class World:
    rest_a: UUID
    rest_b: UUID
    owner_a: UUID
    owner_b: UUID
    chef_a: UUID
    waiter_a: UUID
    central: UUID
    riverside: UUID
    rice_central: UUID
    rice_riverside: UUID
    biryani: UUID
    lassi: UUID


@pytest.fixture()
def session_factory():
    engine = create_engine("sqlite+pysqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False)
    yield factory
    engine.dispose()


@pytest.fixture()
def client(session_factory):
    def override_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def settings():
    return get_settings()


@pytest.fixture(autouse=True)
def fresh_whatsapp_state():
    from app.services.whatsapp_bot import CUSTOMER_STATE

    CUSTOMER_STATE.clear()
    yield
    CUSTOMER_STATE.clear()


@pytest.fixture()
def world(session_factory) -> World:
    """Two restaurants; A has two branches and a dish with recipe lines in both branches."""
    with session_factory() as db:
        rest_a, rest_b = Restaurant(name="Saffron Junction"), Restaurant(name="Curry House")
        db.add_all([rest_a, rest_b])
        db.flush()
        users = {
            "owner_a": User(id=uuid4(), restaurant_id=rest_a.id, email="owner-a@example.com", name="Owner A", role="owner", is_active=True),
            "owner_b": User(id=uuid4(), restaurant_id=rest_b.id, email="owner-b@example.com", name="Owner B", role="owner", is_active=True),
            "chef_a": User(id=uuid4(), restaurant_id=rest_a.id, email="chef-a@example.com", name="Chef A", role="chef", is_active=True),
            "waiter_a": User(id=uuid4(), restaurant_id=rest_a.id, email="waiter-a@example.com", name="Waiter A", role="waiter", is_active=True),
        }
        db.add_all(users.values())
        branch_kwargs = dict(is_active=True, supports_dine_in=True, supports_takeaway=True, supports_delivery=True)
        central = Branch(restaurant_id=rest_a.id, address="Central", **branch_kwargs)
        riverside = Branch(restaurant_id=rest_a.id, address="Riverside", **branch_kwargs)
        db.add_all([central, riverside, Branch(restaurant_id=rest_b.id, address="B Main", **branch_kwargs)])
        db.flush()
        rice_central = InventoryItem(branch_id=central.id, name="Basmati Rice", unit="kg", current_stock=Decimal("10"), safety_stock_level=Decimal("1"), cost_per_unit=Decimal("92"))
        rice_riverside = InventoryItem(branch_id=riverside.id, name="Basmati Rice", unit="kg", current_stock=Decimal("10"), safety_stock_level=Decimal("1"), cost_per_unit=Decimal("92"))
        db.add_all([rice_central, rice_riverside])
        db.flush()
        biryani = MenuItem(restaurant_id=rest_a.id, name="Chicken Biryani", category="Mains", price=Decimal("260"), is_active=True)
        lassi = MenuItem(restaurant_id=rest_a.id, name="Kesar Lassi", category="Beverages", price=Decimal("110"), is_active=True)
        db.add_all([biryani, lassi])
        db.flush()
        db.add_all([
            MenuItemIngredient(menu_item_id=biryani.id, inventory_item_id=rice_central.id, quantity_per_unit=Decimal("0.5")),
            MenuItemIngredient(menu_item_id=biryani.id, inventory_item_id=rice_riverside.id, quantity_per_unit=Decimal("0.5")),
        ])
        db.commit()
        return World(
            rest_a=rest_a.id, rest_b=rest_b.id, central=central.id, riverside=riverside.id,
            rice_central=rice_central.id, rice_riverside=rice_riverside.id, biryani=biryani.id, lassi=lassi.id,
            **{key: user.id for key, user in users.items()},
        )
