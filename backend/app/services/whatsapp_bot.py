from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from google import genai
from google.genai import types
from sqlalchemy import select
from sqlalchemy.orm import Session
from twilio.rest import Client

from app.config import get_settings
from app.models.branch import Branch
from app.models.customer import Customer
from app.models.menu_item import MenuItem
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.restaurant import Restaurant

logger = logging.getLogger(__name__)


# In-memory customer state tracker for active restaurant selection
# { phone_number: {"restaurant_id": UUID, "branch_id": UUID, "last_active": datetime} }
CUSTOMER_STATE: dict[str, dict] = {}


def get_client() -> genai.Client | None:
    settings = get_settings()
    if not settings.gemini_api_key:
        return None
    return genai.Client(api_key=settings.gemini_api_key)


def format_menu_message(restaurant: Restaurant, menu_items: list[MenuItem]) -> str:
    """Format the restaurant's active menu for WhatsApp."""
    header = (
        f"👋 *Welcome to {restaurant.name}!* 🍽️\n"
        f"Here is our fresh kitchen menu today:\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
    )

    categories: dict[str, list[MenuItem]] = {}
    for item in menu_items:
        cat = item.category or "Chef's Specials"
        categories.setdefault(cat, []).append(item)

    lines = [header]
    for cat, items in categories.items():
        lines.append(f"\n📂 *{cat.upper()}*")
        for item in items:
            food_icon = "🟢" if item.food_type == "veg" else "🔴"
            price = f"₹{int(item.price)}"
            lines.append(f"  {food_icon} *{item.name}* — {price}")

    lines.append(
        f"\n━━━━━━━━━━━━━━━━━━━━\n"
        f"💬 *How to order:* Just type what you'd like in plain language!\n"
        f"_e.g. \"Send 2 Chicken Biryani and 1 Kesar Lassi for takeaway\"_"
    )
    return "\n".join(lines)


async def parse_order_with_gemini(
    message_text: str, menu_items: list[MenuItem]
) -> dict:
    """Use Gemini 3.5 Flash Lite to extract structured items and quantities from natural text."""
    client = get_client()
    if not client:
        return {"intent": "unknown", "items": []}

    menu_summary = [
        {
            "id": str(item.id),
            "name": item.name,
            "category": item.category,
            "price": float(item.price),
        }
        for item in menu_items
    ]

    prompt = f"""
You are an expert AI WhatsApp Order Parser for a restaurant.
Customer Message: "{message_text}"

Current Restaurant Menu:
{json.dumps(menu_summary, indent=2)}

Task:
1. Determine if the customer is trying to place an order, asking for menu, or asking a question.
2. If placing an order, match the items to the exact menu_item IDs and quantity.
3. Determine order_type: "TAKEAWAY", "DELIVERY", or "DINE_IN" (default to "TAKEAWAY" if not specified).

Return ONLY valid JSON matching this schema:
{{
  "intent": "order" | "menu" | "question" | "greeting",
  "order_type": "TAKEAWAY" | "DELIVERY" | "DINE_IN",
  "items": [
    {{
      "menu_item_id": "UUID string matching menu item",
      "name": "Menu item name",
      "quantity": 1
    }}
  ],
  "customer_note": "any special instructions or null"
}}
"""

    try:
        settings = get_settings()
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
        return json.loads(response.text)
    except Exception as exc:
        logger.exception("Error calling Gemini for WhatsApp parsing: %s", exc)
        return {"intent": "unknown", "items": []}


async def process_whatsapp_message(
    db: Session,
    phone: str,
    sender_name: str,
    message_text: str,
) -> str:
    """Core conversational engine for processing inbound WhatsApp messages."""
    clean_text = message_text.strip()
    norm_phone = "".join(ch for ch in phone if ch.isdigit() or ch == "+")

    # 1. Look up all active restaurants
    restaurants = db.scalars(select(Restaurant)).all()
    if not restaurants:
        return "⚠️ No active restaurant workspaces found in the database. Please onboard a restaurant first."

    # Check if user mentioned a specific restaurant or if only 1 restaurant exists
    selected_restaurant: Restaurant | None = None
    for r in restaurants:
        if r.name.lower() in clean_text.lower():
            selected_restaurant = r
            break

    state = CUSTOMER_STATE.get(norm_phone)
    if selected_restaurant:
        # User switched / chose restaurant
        CUSTOMER_STATE[norm_phone] = {
            "restaurant_id": selected_restaurant.id,
            "last_active": datetime.now(timezone.utc),
        }
    elif state and "restaurant_id" in state:
        selected_restaurant = db.get(Restaurant, state["restaurant_id"])

    # Default to first available restaurant (e.g. Saffron Junction)
    if not selected_restaurant:
        selected_restaurant = restaurants[0]
        CUSTOMER_STATE[norm_phone] = {
            "restaurant_id": selected_restaurant.id,
            "last_active": datetime.now(timezone.utc),
        }

    # Fetch active menu items for selected restaurant
    menu_items = db.scalars(
        select(MenuItem).where(
            MenuItem.restaurant_id == selected_restaurant.id,
            MenuItem.is_active.is_(True),
        )
    ).all()

    # Find a default branch for this restaurant
    branch = db.scalar(
        select(Branch).where(
            Branch.restaurant_id == selected_restaurant.id,
            Branch.is_active.is_(True),
        ).limit(1)
    )

    if not branch:
        return f"⚠️ {selected_restaurant.name} currently has no active branches configured."

    # 2. Check if greeting or menu request
    lower_msg = clean_text.lower()
    if any(k in lower_msg for k in ["menu", "start", "list", "card", "dishes"]) or lower_msg in ["hi", "hello", "hey", "help", "order"]:
        return format_menu_message(selected_restaurant, menu_items)

    # 3. Use Gemini to parse potential order
    parsed = await parse_order_with_gemini(clean_text, menu_items)

    if parsed.get("intent") in ["menu", "greeting", "question"]:
        return format_menu_message(selected_restaurant, menu_items)

    order_items_data = parsed.get("items", [])
    if not order_items_data:
        # Conversational fallback with menu reminder
        return (
            f"🤖 I didn't quite catch your order from *{selected_restaurant.name}*.\n\n"
            f"Please mention the dish name and quantity, e.g.:\n"
            f"_\"2 Chicken Biryani and 1 Kesar Lassi\"_\n\n"
            f"Type *menu* anytime to view the full menu!"
        )

    # 4. Validate menu items and calculate total
    menu_lookup = {str(item.id): item for item in menu_items}
    valid_items = []
    total_amount = Decimal("0")

    for parsed_item in order_items_data:
        m_id = parsed_item.get("menu_item_id")
        qty = int(parsed_item.get("quantity", 1))
        if m_id in menu_lookup and qty > 0:
            menu_obj = menu_lookup[m_id]
            valid_items.append((menu_obj, qty))
            total_amount += menu_obj.price * qty

    if not valid_items:
        return (
            f"⚠️ We couldn't find those specific dishes on *{selected_restaurant.name}*'s menu.\n"
            f"Type *menu* to see available options!"
        )

    # 5. Get or create Customer
    customer = db.scalar(
        select(Customer).where(
            Customer.restaurant_id == selected_restaurant.id,
            Customer.phone == norm_phone,
        )
    )
    if not customer:
        customer = Customer(
            restaurant_id=selected_restaurant.id,
            phone=norm_phone,
            name=sender_name or "WhatsApp Customer",
            preferred_language="en",
        )
        db.add(customer)
        db.flush()

    # 6. Insert Order into PostgreSQL Database
    order_type = parsed.get("order_type", "TAKEAWAY")
    order = Order(
        restaurant_id=selected_restaurant.id,
        branch_id=branch.id,
        customer_id=customer.id,
        order_source="WHATSAPP",
        order_type=order_type,
        status="PENDING",
        total_amount=total_amount,
        ordered_at=datetime.now(timezone.utc),
    )
    db.add(order)
    db.flush()

    # 7. Insert Order Items
    item_lines = []
    for menu_obj, qty in valid_items:
        oi = OrderItem(
            order_id=order.id,
            menu_item_id=menu_obj.id,
            quantity=qty,
            unit_price=menu_obj.price,
            total_price=menu_obj.price * qty,
        )
        db.add(oi)
        item_lines.append(f"• {qty}x *{menu_obj.name}* (₹{int(menu_obj.price * qty)})")

    db.commit()
    db.refresh(order)

    short_id = str(order.id)[:8]
    summary_text = "\n".join(item_lines)

    return (
        f"✅ *Order Confirmed! (# {short_id})*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"📍 *Restaurant:* {selected_restaurant.name}\n"
        f"📦 *Type:* {order_type.replace('_', ' ')}\n\n"
        f"{summary_text}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"💰 *Total Amount:* ₹{int(total_amount)}\n"
        f"⏱️ *Status:* Sent to Kitchen Chef\n\n"
        f"🎉 We will notify you here on WhatsApp the moment your food is *HOT & READY*! 🍽️"
    )


def send_whatsapp_order_ready_notification(
    customer_phone: str,
    restaurant_name: str,
    order_id: str,
    items_summary: str,
    order_type: str = "TAKEAWAY",
) -> bool:
    """Send proactive WhatsApp notification via Twilio when chef marks order as READY."""
    settings = get_settings()
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        logger.warning("Twilio credentials not configured; skipping WhatsApp notification.")
        return False

    clean_phone = "".join(ch for ch in customer_phone if ch.isdigit() or ch == "+")
    if not clean_phone.startswith("+"):
        clean_phone = f"+{clean_phone}"

    to_whatsapp = f"whatsapp:{clean_phone}"
    short_id = str(order_id)[:8]

    body_message = (
        f"🎉 *{restaurant_name} Kitchen Update!*\n\n"
        f"Your order *#{short_id}* is now *HOT & READY*! 🍽️✨\n\n"
        f"📦 *Order Details:* {items_summary}\n"
        f"📍 *Mode:* {order_type.replace('_', ' ')}\n\n"
        f"Thank you for ordering with {restaurant_name}. Enjoy your meal! 🙏"
    )

    try:
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        message = client.messages.create(
            from_=settings.twilio_whatsapp_number,
            to=to_whatsapp,
            body=body_message,
        )
        logger.info("Sent WhatsApp READY alert to %s (SID: %s)", to_whatsapp, message.sid)
        return True
    except Exception as exc:
        logger.exception("Failed to send WhatsApp notification via Twilio: %s", exc)
        return False
