# Database Design 

# resturant table 
restaurants
────────────────────────────
id              UUID PK
name            VARCHAR(150) NOT NULL
email           VARCHAR(255)
phone           VARCHAR(20)
created_at      TIMESTAMP NOT NULL
updated_at      TIMESTAMP NOT NULL

# branch table 
branches
────────────────────────────
id              UUID PK
restaurant_id   UUID FK NOT NULL
address         TEXT
phone           VARCHAR(20)
is_active       BOOLEAN NOT NULL
created_at      TIMESTAMP NOT NULL
updated_at      TIMESTAMP NOT NULL
supports_dine_in    BOOLEAN NOT NULL
supports_takeaway   BOOLEAN NOT NULL
supports_delivery   BOOLEAN NOT NULL


# restaurant_modules
restaurant_modules
────────────────────────────
id              UUID PK
name            VARCHAR(100) NOT NULL
code            VARCHAR(50) NOT NULL UNIQUE
description     TEXT
price           NUMERIC(10,2) NOT NULL

1 | WhatsApp Ordering       | WHATSAPP       | ... | 399.00
2 | Aggregator Management   | AGGREGATORS    | ... | 599.00
3 | Inventory Intelligence  | INVENTORY      | ... | 399.00
4 | AI Copilot              | AI_COPILOT     | ... | 599.00
5 | Multi-Branch            | MULTI_BRANCH   | ... | 799.00

# subscriptions
subscriptions
────────────────────────────
id                  UUID PK
restaurant_id       UUID FK NOT NULL
module_id           UUID FK NOT NULL
status              VARCHAR(30) NOT NULL
start_date          TIMESTAMP NOT NULL
end_date            TIMESTAMP
created_at          TIMESTAMP NOT NULL
updated_at          TIMESTAMP NOT NULL
UNIQUE(restaurant_id, module_id)

# users
users
────────────────────────────
id              UUID PK
restaurant_id   UUID FK NOT NULL
email           VARCHAR(255) NOT NULL
name            VARCHAR(150) NOT NULL
role            VARCHAR(30) NOT NULL | owner|chef|waiter
is_active       BOOLEAN NOT NULL
created_at      TIMESTAMP NOT NULL
updated_at      TIMESTAMP NOT NULL

# menu_items
menu_items
────────────────────────────────────────
id              UUID PRIMARY KEY
restaurant_id   UUID NOT NULL FK → restaurants.id
name            VARCHAR(150) NOT NULL
description     TEXT
category        VARCHAR(100)
price           NUMERIC(10,2) NOT NULL
is_active       BOOLEAN NOT NULL DEFAULT TRUE
created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

# inventory_items
inventory_items
────────────────────────────────────────
id                  UUID PRIMARY KEY
branch_id           UUID NOT NULL FK → branches.id
name                VARCHAR(150) NOT NULL
unit                VARCHAR(20) NOT NULL
current_stock       NUMERIC(12,3) NOT NULL DEFAULT 0
safety_stock_level  NUMERIC(12,3) NOT NULL DEFAULT 0
reorder_delay_days  INTEGER NOT NULL DEFAULT 0
cost_per_unit       NUMERIC(10,2) NOT NULL
shelf_life_days     INTEGER
supplier_id         UUID FK → suppliers.id
created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

# menu_item_ingredients
menu_item_ingredients
────────────────────────────────────────
id                  UUID PRIMARY KEY
menu_item_id        UUID NOT NULL FK → menu_items.id
inventory_item_id   UUID NOT NULL FK → inventory_items.id
quantity_per_unit   NUMERIC(12,3) NOT NULL

# orders
orders
────────────────────────────────────────
id              UUID PRIMARY KEY
restaurant_id   UUID NOT NULL FK → restaurants.id
branch_id       UUID NOT NULL FK → branches.id
order_source    VARCHAR(30) NOT NULL
order_type      VARCHAR(30) NOT NULL
status          VARCHAR(30) NOT NULL
total_amount    NUMERIC(10,2) NOT NULL
ordered_at      TIMESTAMP NOT NULL
created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

order_source : 
    POS
    WHATSAPP
    SWIGGY
    ZOMATO

order_type:
    DINE_IN
    TAKEAWAY
    DELIVERY

status  : 
    PENDING
    CONFIRMED
    PREPARING
    READY
    COMPLETED
    CANCELLED

#  order_items
order_items
────────────────────────────────────────
id              UUID PRIMARY KEY
order_id        UUID NOT NULL FK → orders.id
menu_item_id    UUID NOT NULL FK → menu_items.id
quantity        INTEGER NOT NULL
unit_price      NUMERIC(10,2) NOT NULL
total_price     NUMERIC(10,2) NOT NULL

CHECK(quantity > 0)
CHECK(unit_price >= 0)
CHECK(total_price >= 0)

# inventory_transactions
inventory_transactions
────────────────────────────────────────
id                  UUID PRIMARY KEY
inventory_item_id   UUID NOT NULL FK → inventory_items.id
branch_id           UUID NOT NULL FK → branches.id
transaction_type    VARCHAR(30) NOT NULL
quantity            NUMERIC(12,3) NOT NULL
unit_cost           NUMERIC(10,2)
reference_id        UUID
created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

#  demand_forecasts
demand_forecasts
────────────────────────────────────────
id                  UUID PK
branch_id           UUID FK NOT NULL
menu_item_id        UUID FK NOT NULL
forecast_date       DATE NOT NULL
predicted_quantity  NUMERIC(12,2) NOT NULL
created_at          TIMESTAMP NOT NULL

UNIQUE(branch_id, menu_item_id, forecast_date)

# purchase_orders
purchase_orders
────────────────────────────────────────
id                  UUID PRIMARY KEY
branch_id           UUID NOT NULL FK → branches.id
status              VARCHAR(30) NOT NULL
total_amount        NUMERIC(10,2) NOT NULL
created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

status : 
    DRAFT
    PENDING
    ORDERED
    RECEIVED
    CANCELLED

# purchase_order_items
purchase_order_items
────────────────────────────────────────
id                  UUID PRIMARY KEY
purchase_order_id   UUID NOT NULL FK → purchase_orders.id
inventory_item_id   UUID NOT NULL FK → inventory_items.id
quantity            NUMERIC(12,3) NOT NULL
unit_cost           NUMERIC(10,2) NOT NULL
total_price         NUMERIC(10,2) NOT NULL


# Overall relationship  
                         restaurants
                       /      |       \
                      /       |        \
                     ▼        ▼         ▼
                branches    users    subscriptions
                   │                    │
                   │                    ▼
                   │              restaurant_modules
                   │
          ┌────────┼───────────┐
          ▼        ▼           ▼
   inventory_items orders   purchase_orders
        │            │            │
        │            ▼            ▼
        │       order_items  purchase_order_items
        │            │            │
        │            ▼            │
        └───────► menu_items ◄────┘
                     │
                     ▼
           menu_item_ingredients
                     │
                     ▼
              inventory_items

        orders → demand_forecasts
                    │
                    ▼
             XGBoost predictions

# Rasoi Sathi — Database Relationship Specification
1. restaurants → branches

Relationship: One-to-Many

restaurants
    │
    └──< branches
One restaurant can have one or many branches.
Every branch belongs to exactly one restaurant.
branches.restaurant_id → restaurants.id
A restaurant can exist with only one branch.
Deleting a restaurant should delete its branches only if we explicitly use cascade.

SQLAlchemy:

Restaurant.branches
Branch.restaurant
2. restaurants → users

Relationship: One-to-Many

restaurants
    │
    └──< users
One restaurant can have many users.
Every user belongs to exactly one restaurant.
users.restaurant_id → restaurants.id
A user has exactly one role:
OWNER
CHEF
WAITER

Important:

Supabase Auth owns authentication.

Our users.id should correspond to the Supabase Auth user's UUID.

We do not store passwords or OTPs.

3. restaurants → menu_items

Relationship: One-to-Many

restaurants
    │
    └──< menu_items
A restaurant owns its menu items.
Every menu item belongs to exactly one restaurant.
menu_items.restaurant_id → restaurants.id

Example:

Restaurant A
├── Chicken Biryani
├── Paneer Tikka
└── Butter Chicken
4. restaurants → subscriptions

Relationship: One-to-Many

restaurants
    │
    └──< subscriptions
A restaurant can subscribe to multiple modules.
Each subscription belongs to exactly one restaurant.
subscriptions.restaurant_id → restaurants.id

Example:

Restaurant A
├── WhatsApp       ACTIVE
├── Inventory      ACTIVE
└── AI Copilot     EXPIRED

The constraint:

UNIQUE(restaurant_id, module_id)

means a restaurant cannot have duplicate subscriptions for the same module.

5. restaurant_modules → subscriptions

Relationship: One-to-Many

restaurant_modules
        │
        └──< subscriptions
restaurant_modules is the catalog of modules Rasoi Sathi offers.
A module can be subscribed to by many restaurants.
Each subscription refers to exactly one module.
subscriptions.module_id → restaurant_modules.id

Example:

WHATSAPP ORDERING
       │
       ├── Restaurant A subscription
       ├── Restaurant B subscription
       └── Restaurant C subscription

Therefore:

restaurants
     │
     └── subscriptions ──── restaurant_modules

This is effectively a Many-to-Many relationship between restaurants and modules through subscriptions.

6. restaurants → branches → inventory_items

Relationship: Two-step One-to-Many

restaurants
     │
     └──< branches
             │
             └──< inventory_items

Important:

Inventory is branch-specific.

inventory_items does NOT have restaurant_id.

Instead:

inventory_items.branch_id
        ↓
branches.id
        ↓
branches.restaurant_id
        ↓
restaurants.id

Example:

Restaurant A


Branch Nagpur
├── Chicken → 20 kg
├── Rice → 50 kg
└── Oil → 10 L


Branch Pune
├── Chicken → 35 kg
├── Rice → 70 kg
└── Oil → 15 L

This is intentional.

7. menu_items ↔ inventory_items

This is a Many-to-Many relationship through menu_item_ingredients.

menu_items
     │
     └──< menu_item_ingredients >── inventory_items

One menu item uses many inventory items:

Chicken Biryani
├── Rice
├── Chicken
├── Onion
└── Oil

One inventory item can be used by many menu items:

Chicken
├── Chicken Biryani
├── Chicken Curry
└── Chicken Tikka

Therefore:

menu_items
     │
     └── menu_item_ingredients
                    │
                    └── inventory_items

menu_item_ingredients contains:

menu_item_id
inventory_item_id
quantity_per_unit

And:

UNIQUE(menu_item_id, inventory_item_id)

prevents the same ingredient from being added twice to the same recipe.

8. branches → orders

Relationship: One-to-Many

branches
    │
    └──< orders
One branch can receive many orders.
Every order belongs to exactly one branch.
orders.branch_id → branches.id

This is important because demand forecasting is branch-specific.

Example:

Nagpur Branch
├── Order 1
├── Order 2
└── Order 3


Pune Branch
├── Order 4
└── Order 5
9. restaurants → orders

Relationship: One-to-Many

restaurants
    │
    └──< orders
Every order belongs to one restaurant.
orders.restaurant_id → restaurants.id

Even though orders already has branch_id, we intentionally keep restaurant_id.

This makes restaurant-level querying/analytics easier.

Important consistency rule

The backend must ensure:

orders.restaurant_id

matches:

orders.branch_id → branches.restaurant_id

An order must never belong to Restaurant A while its branch belongs to Restaurant B.

10. orders → order_items

Relationship: One-to-Many

orders
    │
    └──< order_items

One order contains multiple dishes.

Example:

Order #1001
├── Chicken Biryani × 2
├── Paneer Tikka × 1
└── Coke × 2

order_items.order_id → orders.id

11. menu_items → order_items

Relationship: One-to-Many

menu_items
    │
    └──< order_items

A menu item can appear in many different orders.

Example:

Chicken Biryani
├── Order 1001
├── Order 1007
├── Order 1015
└── Order 1032

order_items.menu_item_id → menu_items.id

Together:

orders
   │
   └──< order_items >── menu_items

This is effectively the Many-to-Many relationship between orders and menu items.

12. inventory_items → inventory_transactions

Relationship: One-to-Many

inventory_items
      │
      └──< inventory_transactions

One inventory item can have many transactions.

Example:

Chicken
├── PURCHASE +20 kg
├── CONSUMPTION -5 kg
├── WASTE -2 kg
└── ADJUSTMENT +1 kg

inventory_transactions.inventory_item_id → inventory_items.id

13. branches → inventory_transactions

Relationship: One-to-Many

branches
    │
    └──< inventory_transactions

Every inventory transaction happens at a specific branch.

inventory_transactions.branch_id → branches.id

This lets us answer:

How much chicken was wasted at the Nagpur branch?

14. branches → demand_forecasts

Relationship: One-to-Many

branches
    │
    └──< demand_forecasts

Each forecast belongs to one branch.

demand_forecasts.branch_id → branches.id

Example:

Nagpur
├── Chicken Biryani → 82
├── Paneer Tikka → 41
└── Butter Chicken → 35
15. menu_items → demand_forecasts

Relationship: One-to-Many

menu_items
    │
    └──< demand_forecasts

A menu item can have many forecasts across different dates/branches.

Example:

Chicken Biryani


Aug 22 → 70
Aug 23 → 76
Aug 24 → 82
Aug 25 → 80

demand_forecasts.menu_item_id → menu_items.id

Together:

branches
    │
    └──< demand_forecasts >── menu_items

Constraint:

UNIQUE(branch_id, menu_item_id, forecast_date)
16. branches → purchase_orders

Relationship: One-to-Many

branches
    │
    └──< purchase_orders

A branch can create many purchase orders.

purchase_orders.branch_id → branches.id

Example:

Nagpur Branch
├── PO #001 → Chicken + Rice
├── PO #002 → Oil
└── PO #003 → Vegetables
17. purchase_orders → purchase_order_items

Relationship: One-to-Many

purchase_orders
      │
      └──< purchase_order_items

One purchase order contains multiple inventory items.

Example:

PO #001
├── Chicken → 10 kg
├── Rice → 20 kg
└── Oil → 5 L

purchase_order_items.purchase_order_id → purchase_orders.id

18. inventory_items → purchase_order_items

Relationship: One-to-Many

inventory_items
      │
      └──< purchase_order_items

An inventory item can appear in many purchase orders.

Example:

Chicken
├── PO #001 → 10 kg
├── PO #007 → 15 kg
└── PO #014 → 20 kg

purchase_order_items.inventory_item_id → inventory_items.id

Together:

purchase_orders
      │
      └──< purchase_order_items >── inventory_items

This is effectively a Many-to-Many relationship between purchase orders and inventory items.

Complete relationship map

Give this directly to the coding agents:

restaurants
│
├── 1:N → branches
│             │
│             ├── 1:N → inventory_items
│             │             │
│             │             ├── 1:N → inventory_transactions
│             │             └── 1:N → purchase_order_items
│             │
│             ├── 1:N → orders
│             │             │
│             │             └── 1:N → order_items
│             │
│             ├── 1:N → demand_forecasts
│             │
│             └── 1:N → purchase_orders
│                           │
│                           └── 1:N → purchase_order_items
│
├── 1:N → users
│
├── 1:N → menu_items
│             │
│             ├── 1:N → order_items
│             │
│             ├── 1:N → demand_forecasts
│             │
│             └── 1:N → menu_item_ingredients
│                              │
│                              └── N:1 → inventory_items
│
└── 1:N → subscriptions
                  │
                  └── N:1 → restaurant_modules
The critical business relationships

The agents especially need to understand these four:

Menu → Recipe → Inventory
menu_items
    ↓
menu_item_ingredients
    ↓
inventory_items
Orders → Demand Forecasting
orders
    ↓
order_items
    ↓
menu_items
    ↓
XGBoost
    ↓
demand_forecasts
Forecast → Procurement
demand_forecasts
    ↓
recipe quantities
    ↓
inventory_items.current_stock
    ↓
reorder calculation
    ↓
purchase_orders
    ↓
purchase_order_items
Branch isolation

Everything operational must remain branch-specific:

Restaurant
├── Branch A
│    ├── Orders
│    ├── Inventory
│    ├── Forecasts
│    └── Purchase Orders
│
└── Branch B
     ├── Orders
     ├── Inventory
     ├── Forecasts
     └── Purchase Orders

Never allow Branch A's inventory/orders/forecasts/purchase orders to be accessed through Branch B.

One correction to your current schema before the agents code it: remove supplier_id from inventory_items, because we explicitly decided not to have a suppliers table.