"""The shared demo workspace ("Saffron Junction") that anyone can sign in to from the login page.

Created and reset by `python seed_demo.py`. Visitors can use it freely, except for changes
that would lock out the next visitor (staff, outlets) or reach real people (WhatsApp).
"""
from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status

DEMO_RESTAURANT_ID = UUID("2f3c7d18-9f0f-4f3f-9f73-8ec6b8d0a001")
DEMO_RESTAURANT_NAME = "Saffron Junction"

# (role, display name, login email). The domain is deliberately unregistered: Supabase needs a
# real-looking address, and no email can ever be delivered to these accounts.
DEMO_EMAIL_DOMAIN = "rasoisaathi-demo.app"
DEMO_ACCOUNTS = (
    ("owner", "Demo Owner", f"owner@{DEMO_EMAIL_DOMAIN}"),
    ("chef", "Demo Chef", f"chef@{DEMO_EMAIL_DOMAIN}"),
    ("waiter", "Demo Waiter", f"waiter@{DEMO_EMAIL_DOMAIN}"),
)


def is_demo_restaurant(restaurant_id: UUID | None) -> bool:
    return restaurant_id == DEMO_RESTAURANT_ID


def forbid_in_demo(restaurant_id: UUID, action: str) -> None:
    if is_demo_restaurant(restaurant_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{action} is turned off in the demo workspace so it keeps working for the next visitor. Create your own workspace to try it.",
        )
