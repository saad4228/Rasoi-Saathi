from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.demo import DEMO_ACCOUNTS, DEMO_RESTAURANT_ID, DEMO_RESTAURANT_NAME
from app.models.user import User
from app.services.demo_workspace import demo_is_stale, refresh_demo_in_background

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.get("/accounts")
def demo_accounts(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Public: the demo logins shown on the login page, once `python seed_demo.py` has created them.

    Also the demo's clock: a demo built on an earlier day or hours ago is rebuilt right after this
    answers (it takes several seconds), so visitors get live tickets, today's sales and none of the
    last visitor's changes.
    """
    if demo_is_stale(db):
        background_tasks.add_task(refresh_demo_in_background, db.get_bind())
    emails = [email for _, _, email in DEMO_ACCOUNTS]
    ready = set(
        db.scalars(
            select(User.email).where(
                User.restaurant_id == DEMO_RESTAURANT_ID,
                User.email.in_(emails),
                User.is_active.is_(True),
            )
        ).all()
    )
    accounts = [{"role": role, "name": name, "email": email} for role, name, email in DEMO_ACCOUNTS if email in ready]
    if not accounts:
        return {"available": False, "accounts": []}
    return {
        "available": True,
        "restaurant": DEMO_RESTAURANT_NAME,
        "password": get_settings().demo_password,
        "accounts": accounts,
    }
