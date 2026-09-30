"""Create or reset the public demo workspace ("Saffron Junction").

    python seed_demo.py               # create the demo, or reset it to a fresh state
    python seed_demo.py --if-missing  # only create it if it doesn't exist yet (dev.cmd uses this)

Creates three Supabase logins (owner / chef / waiter, password = DEMO_PASSWORD, default
"SaffronDemo@2026") shown on the login page, and fills the workspace with two outlets, a menu
with recipes, stock, four weeks of order history and a few live tickets. Every run rebuilds the
workspace from scratch, which also undoes whatever demo visitors changed. After the first run
the API also rebuilds it by itself every few hours (app/services/demo_workspace.py).

Needs "Confirm email" turned off in Supabase (Authentication -> Sign In / Providers -> Email).
"""
from __future__ import annotations

import sys
from pathlib import Path
from uuid import UUID

import httpx
from dotenv import dotenv_values
from sqlalchemy import select

import app.models  # noqa: F401  (registers every table)
from app.config import get_settings
from app.database import SessionLocal
from app.demo import DEMO_ACCOUNTS, DEMO_RESTAURANT_ID, DEMO_RESTAURANT_NAME
from app.models import User
from app.routers.operations import module_catalog
from app.services.demo_workspace import build_demo, wipe_demo

FRONTEND_ENV = Path(__file__).resolve().parent.parent / "frontend-mockup" / ".env"


def publishable_key() -> str:
    """The public (anon / publishable) key, from backend/.env or the frontend's .env."""
    backend = {k.strip(): (v or "").strip() for k, v in dotenv_values(Path(__file__).resolve().parent / ".env").items()}
    frontend = {k.strip(): (v or "").strip() for k, v in dotenv_values(FRONTEND_ENV).items()} if FRONTEND_ENV.exists() else {}
    key = backend.get("SUPABASE_ANON_KEY") or frontend.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not key:
        sys.exit("Set NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend-mockup/.env (Supabase -> Project Settings -> API Keys).")
    return key


def demo_login_id(client: httpx.Client, email: str, password: str) -> UUID:
    """Sign in to the demo login, creating it on first run. Returns its Supabase user id."""
    signin = client.post("/token?grant_type=password", json={"email": email, "password": password})
    if signin.status_code == 200:
        return UUID(signin.json()["user"]["id"])
    code = signin.json().get("error_code") or signin.json().get("code")
    if code == "email_not_confirmed":
        sys.exit(
            f"{email} exists but its email isn't confirmed. Turn off 'Confirm email' in Supabase "
            "(Authentication -> Sign In / Providers -> Email), delete that user under Authentication -> Users, then run this again."
        )

    if not client.get("/settings").json().get("mailer_autoconfirm"):
        sys.exit(
            "Supabase still has 'Confirm email' turned on, so the demo logins can't be created.\n"
            "Turn it off: Supabase -> Authentication -> Sign In / Providers -> Email -> 'Confirm email' -> Save. Then run this again."
        )
    signup = client.post("/signup", json={"email": email, "password": password})
    body = signup.json()
    if signup.status_code >= 400:
        code = body.get("error_code") or body.get("code")
        if code in ("user_already_exists", "email_exists"):
            sys.exit(
                f"{email} already exists with a different password. Delete it in Supabase -> Authentication -> Users, then run this again."
            )
        sys.exit(f"Supabase refused to create {email}: {body.get('msg') or body.get('message') or body}")
    if not body.get("access_token"):
        sys.exit(
            f"Created {email}, but Supabase wants its email confirmed first. Turn off 'Confirm email' "
            "(Authentication -> Sign In / Providers -> Email), delete the user under Authentication -> Users, then run this again."
        )
    return UUID(body["user"]["id"])


def main() -> None:
    if_missing = "--if-missing" in sys.argv[1:]
    settings = get_settings()

    with SessionLocal() as db:
        owner_email = DEMO_ACCOUNTS[0][2]
        exists = db.scalar(select(User.id).where(User.restaurant_id == DEMO_RESTAURANT_ID, User.email == owner_email))
        module_ids = [module.id for module in module_catalog(db).values()]  # commits the catalog if it was missing
    if if_missing and exists:
        print("Demo workspace already set up.")
        return

    base_url = f"{settings.supabase_url.rstrip('/')}/auth/v1"
    with httpx.Client(base_url=base_url, headers={"apikey": publishable_key()}, timeout=20) as client:
        login_ids = {role: demo_login_id(client, email, settings.demo_password) for role, _, email in DEMO_ACCOUNTS}

    with SessionLocal() as db:
        # One transaction: a failure leaves the previous demo untouched.
        wipe_demo(db, list(login_ids.values()))
        counts = build_demo(db, login_ids, module_ids)
        db.commit()

    print(f"Demo workspace '{DEMO_RESTAURANT_NAME}' is ready: " + ", ".join(f"{n} {label}" for label, n in counts.items()) + ".")
    print(f"Logins (password: {settings.demo_password}):")
    for role, _, email in DEMO_ACCOUNTS:
        print(f"  {role:<6} {email}")


if __name__ == "__main__":
    main()
