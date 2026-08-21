Yes. Let's lock the SQLAlchemy architecture first, then generate the files. Don't start writing routers yet.

Step 1 — Use this exact backend structure
backend/
│
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── database.py
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── restaurant.py
│   │   ├── branch.py
│   │   ├── restaurant_module.py
│   │   ├── subscription.py
│   │   ├── user.py
│   │   ├── menu_item.py
│   │   ├── inventory_item.py
│   │   ├── menu_item_ingredient.py
│   │   ├── order.py
│   │   ├── order_item.py
│   │   ├── inventory_transaction.py
│   │   ├── demand_forecast.py
│   │   ├── purchase_order.py
│   │   └── purchase_order_item.py
│   │
│   ├── schemas/
│   ├── routers/
│   ├── services/
│   └── core/
│
├── alembic/
├── tests/
├── .env
├── requirements.txt
└── alembic.ini
Step 2 — SQLAlchemy version

Use SQLAlchemy 2.0 style, not the old Column()-heavy style.

For example:

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column


name: Mapped[str] = mapped_column(String(150), nullable=False)

Use:

DeclarativeBase
Mapped
mapped_column
relationship
Step 3 — UUID convention

All our primary keys are UUIDs.

Use PostgreSQL UUID:

from uuid import UUID, uuid4
from sqlalchemy.dialects.postgresql import UUID as PGUUID

Example:

id: Mapped[UUID] = mapped_column(
    PGUUID(as_uuid=True),
    primary_key=True,
    default=uuid4
)

So UUID generation happens in Python.

Step 4 — Create a common Base

Create:

app/database.py

with the SQLAlchemy engine, session factory and declarative base.

Conceptually:

database.py
│
├── engine
├── SessionLocal
└── Base

Your .env contains the PostgreSQL connection URL.

Don't hardcode the Supabase password in Python files.

Step 5 — Timestamps

For all tables with timestamps:

created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True),
    server_default=func.now(),
    nullable=False
)

And:

updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True),
    server_default=func.now(),
    onupdate=func.now(),
    nullable=False
)

Use timezone-aware timestamps.

Step 6 — Relationships

The agent should explicitly define both sides.

Example:

class Restaurant(Base):
    ...


    branches: Mapped[list["Branch"]] = relationship(
        back_populates="restaurant"
    )

and:

class Branch(Base):
    ...


    restaurant_id: Mapped[UUID] = mapped_column(
        ForeignKey("restaurants.id"),
        nullable=False
    )


    restaurant: Mapped["Restaurant"] = relationship(
        back_populates="branches"
    )

Do this consistently for all relationships we defined.

Step 7 — Don't use PostgreSQL ENUMs yet

For things like:

OWNER
CHEF
WAITER

and:

PENDING
CONFIRMED
PREPARING
...

I'd keep them as:

String(30)

with application-level validation.

Why?

During a hackathon we're likely to change a status.

Changing a PostgreSQL ENUM later is more annoying than changing a string validation rule.

So:

role: Mapped[str] = mapped_column(String(30), nullable=False)

Then validate allowed values in your Pydantic schemas/services.

Step 8 — Constraints

Definitely encode the important database constraints.

For example:

menu_item_ingredients
UNIQUE(menu_item_id, inventory_item_id)
demand_forecasts
UNIQUE(branch_id, menu_item_id, forecast_date)
order_items
quantity > 0
unit_price >= 0
total_price >= 0

Also add sensible checks such as:

price >= 0
current_stock >= 0
safety_stock_level >= 0
cost_per_unit >= 0
quantity > 0
Step 9 — Indexes

Don't go crazy with indexes.

At minimum, index foreign keys that we'll frequently query:

branches.restaurant_id
users.restaurant_id
menu_items.restaurant_id
subscriptions.restaurant_id
subscriptions.module_id


inventory_items.branch_id


orders.restaurant_id
orders.branch_id


order_items.order_id
order_items.menu_item_id


inventory_transactions.inventory_item_id
inventory_transactions.branch_id


demand_forecasts.branch_id
demand_forecasts.menu_item_id


purchase_orders.branch_id
purchase_order_items.purchase_order_id
purchase_order_items.inventory_item_id

The unique constraints will already create indexes where applicable.

Step 10 — VERY important: restaurant/branch consistency

Don't let the agent assume foreign keys alone solve everything.

For example:

orders.restaurant_id = Restaurant A
orders.branch_id     = Branch belonging to Restaurant B

is technically possible with the current schema.

Your service layer must validate that:

order.branch.restaurant_id == order.restaurant_id

Same concept applies when creating:

inventory items
orders
forecasts
purchase orders

This is an application-level business rule.

Step 11 — Inventory relationship

Remember this decision:

Restaurant
    ↓
Branch
    ↓
Inventory

NOT:

Restaurant
    ↓
Inventory

So inventory_items must NOT contain restaurant_id.

And because we rejected suppliers:

supplier_id

must also be removed.

Final:

inventory_items
────────────────────────────────
id
branch_id
name
unit
current_stock
safety_stock_level
reorder_delay_days
cost_per_unit
shelf_life_days
created_at
updated_at
Step 12 — Authentication

Don't create:

password
password_hash
otp
otp_code

in users.

We're using Supabase Auth for email/OTP authentication.

Our users table is the application's profile/authorization layer:

Supabase Auth
      │
      │ user UUID
      ▼
users
      │
      ├── restaurant_id
      └── role

So:

users.id

should correspond to the Supabase Auth user's UUID.

Step 13 — Alembic

Install:

pip install sqlalchemy psycopg[binary] alembic pydantic-settings

Then initialize:

alembic init alembic

Configure Alembic to import your:

Base.metadata

Then the workflow becomes:

SQLAlchemy models
       ↓
alembic revision --autogenerate
       ↓
migration file
       ↓
alembic upgrade head
       ↓
Supabase PostgreSQL

Do not manually create all 14 tables in Supabase.

Let Alembic create them.

Step 14 — Now use your coding agent

Give the agent this instruction:

Implement the SQLAlchemy 2.0 ORM layer for Rasoi Sathi using the database schema and relationship specification provided below.

Generate all 14 model files under app/models/.

Requirements:

PostgreSQL + SQLAlchemy 2.0.
Use DeclarativeBase, Mapped, and mapped_column.
UUID primary keys using uuid4.
Timezone-aware created_at and updated_at.
Explicit foreign keys and bidirectional relationship(..., back_populates=...).
Implement all UNIQUE and CHECK constraints specified.
Add indexes to frequently queried foreign-key columns.
Use String for roles/status/source/type values rather than PostgreSQL ENUMs.
Do not invent tables or fields.
Do not create a suppliers table.
Do not add supplier_id.
Inventory is branch-specific.
Do not add password or OTP fields; authentication is handled by Supabase Auth.
users.id corresponds to the Supabase Auth user UUID.
Do not add a dining tables table.
Do not add unnecessary relationships.
Create app/models/__init__.py that imports all models so Alembic can discover them.
Do not create API routes, services, schemas, authentication logic, or frontend code yet.

After generating the models, verify that all foreign keys and relationships match the provided relationship specification.

Then paste the 14 table definitions + relationship map we finalized.