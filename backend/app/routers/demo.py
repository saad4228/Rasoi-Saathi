from __future__ import annotations

import threading
import time
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.demo import DEMO_ACCOUNTS, DEMO_RESTAURANT_ID, DEMO_RESTAURANT_NAME
from app.models.restaurant import Restaurant
from app.models.user import User
from app.services.demo_workspace import built_at_is_stale, start_demo_refresh

router = APIRouter(prefix="/api/demo", tags=["demo"])

# The login page can't show its "Try as Owner / Chef / Waiter" buttons until this answers, and
# the database is a round trip away: ~150 ms per query to a hosted Supabase region, ~2.5 s for
# the very first connection. The answer is three fixed logins that only change when the demo is
# re-seeded, so it is cached in memory and almost every visitor gets the buttons without waiting
# for the database at all.
#
# The TTL is short on purpose: it is also how often the rebuild clock below gets to tick (the
# demo only needs rebuilding every few hours), and how long `python seed_demo.py` takes to show up.
CACHE_TTL_SECONDS = 60.0
NO_DEMO_CACHE_TTL_SECONDS = 5.0

_cache_lock = threading.Lock()
_cached: tuple[float, dict] | None = None


def reset_cache() -> None:
    """Forget the cached answer. Used by the tests; each one gets its own database."""
    global _cached
    with _cache_lock:
        _cached = None


def _load_demo_state(db: Session) -> tuple[datetime | None, list[dict]]:
    """The demo's build time and its usable logins, in a single round trip.

    One outer join instead of a query for the restaurant and another for the users: on a hosted
    database the second round trip costs as much as the work itself. No rows means the demo has
    never been seeded; a row with no email means it was seeded without its logins.
    """
    emails = [email for _, _, email in DEMO_ACCOUNTS]
    rows = db.execute(
        select(Restaurant.created_at, User.email)
        .outerjoin(
            User,
            and_(
                User.restaurant_id == Restaurant.id,
                User.email.in_(emails),
                User.is_active.is_(True),
            ),
        )
        .where(Restaurant.id == DEMO_RESTAURANT_ID)
    ).all()
    if not rows:
        return None, []

    built_at = rows[0][0]
    ready = {email for _, email in rows if email}
    accounts = [
        {"role": role, "name": name, "email": email}
        for role, name, email in DEMO_ACCOUNTS
        if email in ready
    ]
    return built_at, accounts


@router.get("/accounts")
def demo_accounts(db: Session = Depends(get_db)):
    """Public: the demo logins shown on the login page, once `python seed_demo.py` has created them.

    Also the demo's clock: a demo built on an earlier day or hours ago is rebuilt in the
    background, so visitors get live tickets, today's sales and none of the last visitor's changes.
    """
    global _cached

    now = time.monotonic()
    with _cache_lock:
        if _cached is not None and now < _cached[0]:
            return _cached[1]

    built_at, accounts = _load_demo_state(db)
    if built_at is not None and built_at_is_stale(built_at):
        start_demo_refresh(db.get_bind())

    if accounts:
        payload = {
            "available": True,
            "restaurant": DEMO_RESTAURANT_NAME,
            "password": get_settings().demo_password,
            "accounts": accounts,
        }
        ttl = CACHE_TTL_SECONDS
    else:
        payload = {"available": False, "accounts": []}
        ttl = NO_DEMO_CACHE_TTL_SECONDS

    with _cache_lock:
        _cached = (time.monotonic() + ttl, payload)
    return payload
