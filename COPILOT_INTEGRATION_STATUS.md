# AI Copilot Integration Status

## Purpose

The `co pilot` folder supplied the initial prototype. Its useful design has been adapted into the main `backend` service so there will be one production Copilot service, not a separate SQLite application.

`frontend-mockup` is connected to the backend endpoint.

## Changes completed so far

### 1. Copilot API added to the main backend

- Added an authenticated, owner-only endpoint: `POST /api/copilot/chat`. It accepts recent chat turns (`history`) so follow-up questions keep context.
- It uses the same Supabase JWT authentication as the rest of the backend.
- The restaurant is always obtained from the logged-in application user. The browser cannot select another restaurant by sending a different ID.
- An optional `branch_id` is accepted. The backend verifies that it is an active branch belonging to the user's restaurant before querying data.
- Added request/response schemas for the chat API.

### 2. Prototype SQLite data layer replaced

- The integrated Copilot does not use the prototype's separate `restaurant.db`, `products`, `sales`, `sale_items`, or `expenses` tables.
- It reads the existing backend models backed by the main PostgreSQL/Supabase database: branches, orders, order items, menu items, recipes, inventory items, and demand forecasts.
- All Copilot data tools are read-only.

### 3. Gemini function-calling service added

- Moved the useful function-calling approach from the friend's Copilot prototype into `backend/app/services/copilot.py`.
- Gemini is loaded only when a chat request is made, so the normal backend health/API startup does not fail if the key is missing.
- Added a maximum of four tool-call rounds per chat request to prevent a model loop from holding the API forever.
- Added clear API errors when `GEMINI_API_KEY` is absent, Gemini cannot be reached, or the dependency is not installed.
- Added `GEMINI_API_KEY` and configurable `GEMINI_MODEL` entries to `backend/.env.example`.
- Added the missing `google-genai` package to `backend/requirements.txt`.

### 4. Business insights currently available to the Copilot

- Dish sales: completed-order quantity and revenue.
- Recipe-based dish gross profit: selling price, ingredient cost, food cost, gross profit, and gross margin.
- Price simulations with an explicit expected sales-volume change assumption.
- Break-even volume after a price change.
- Branch comparison: revenue, completed orders, and average order value.
- Sales trends: latest period compared with the immediately preceding equivalent period.
- Dish performance: top dishes by completed-sales revenue.
- Order-source performance: POS, WhatsApp, Swiggy, and Zomato comparison.
- Low-stock ingredients.
- Dish demand estimates from same-weekday averages of recent completed sales.
- Reorder suggestions from the same forecasting engine as the Inventory page (`generate_reorder_alerts`).

### 5. `frontend-mockup` chat page connected

- Removed the canned `getMockResponse()` responses.
- The Copilot page now uses the existing authenticated API helper to call `/api/copilot/chat`.
- The page uses the outlet selected in the top bar.
- The UI shows request errors instead of silently presenting invented results.

### 6. RAG policy document layer integrated ✅ NEW

- Copied the friend's pre-built `vector_store.json` (7 restaurant policy documents embedded with `gemini-embedding-001`) into `backend/app/rag/`.
- Created `backend/app/rag/retriever.py` — a production-safe retriever that:
  - Lazy-loads the vector store from disk (cached in memory after first use).
  - Embeds the user's query at request time using `gemini-embedding-001`.
  - Returns the top-3 most relevant policy snippets (cosine similarity ≥ 0.55 threshold).
  - Silently returns empty context if the API key is missing or the call fails — the backend never crashes.
- Wired `get_policy_context()` into `GeminiCopilot.answer()` in `backend/app/services/copilot.py` — policy context is prepended to the system instruction when relevant.
- The 7 policy documents now searchable via the Copilot:
  - Restaurant Refund Policy
  - Customer Complaint Policy
  - Kitchen Hygiene Policy
  - Restaurant Opening Procedure
  - Restaurant Closing Procedure
  - Inventory Procedure
  - Staff Customer Service

### 7. `google-genai` dependency installed in backend venv ✅ NEW

- Ran `backend\venv\Scripts\pip install google-genai==2.17.0` — installed successfully with all required dependencies.

### 8. Tests and checks

- `backend/tests` (run `pytest` in `backend/`) covers the Copilot calculations plus auth, staff, orders, stock deduction, reporting, WhatsApp and forecasting on an in-memory database.
- `npm run lint` and `next build` pass for `frontend-mockup`.

## Important behaviour and limitations

- The Copilot reports **gross profit**, not net profit: there is no expenses table for rent, salaries, electricity, packaging or marketing.
- Dish profit, price simulation, break-even and reorder suggestions need an outlet, because recipe costs and stock are outlet-specific.
- All figures come from completed orders only, matching the dashboard and analytics.

## Remaining work

1. Add a valid `GEMINI_API_KEY` to `backend/.env` (from https://aistudio.google.com/app/apikey) and exercise `/api/copilot/chat` against real data.
2. Decide whether to add an expenses table for net-profit insights.
3. Remove the old `co pilot` prototype folder once the integrated version is accepted.
