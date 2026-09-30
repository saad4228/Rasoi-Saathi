from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_authenticated_user_claims, get_current_user
from app.database import get_db
from app.demo import is_demo_restaurant
from app.models.branch import Branch
from app.models.restaurant import Restaurant
from app.models.user import User
from app.schemas.auth import AuthUserResponse, OnboardingRequest


router = APIRouter(prefix="/api/auth", tags=["auth"])


def profile_response(db: Session, user: User) -> AuthUserResponse:
    restaurant = db.get(Restaurant, user.restaurant_id)
    return AuthUserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        restaurant_id=user.restaurant_id,
        restaurant_name=restaurant.name if restaurant else None,
        is_demo=is_demo_restaurant(user.restaurant_id),
    )


@router.get("/me", response_model=AuthUserResponse)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AuthUserResponse:
    return profile_response(db, current_user)


@router.post("/onboarding", response_model=AuthUserResponse)
def onboard_owner(
    payload: OnboardingRequest,
    claims: Annotated[dict[str, Any], Depends(get_authenticated_user_claims)],
    db: Session = Depends(get_db),
) -> AuthUserResponse:
    try:
        user_id = UUID(claims["sub"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authenticated user") from exc

    existing_user = db.get(User, user_id)
    if existing_user is not None:
        return profile_response(db, existing_user)

    user_email = claims.get("email")
    if not isinstance(user_email, str) or not user_email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authenticated email is unavailable")

    try:
        restaurant = Restaurant(
            name=payload.restaurant_name,
            email=payload.restaurant_email,
            phone=payload.restaurant_phone,
        )
        db.add(restaurant)
        db.flush()

        # Menu, inventory and orders are all branch-scoped, so every workspace starts with one branch.
        db.add(
            Branch(
                restaurant_id=restaurant.id,
                address=(payload.branch_address or "").strip() or "Main Branch",
                phone=payload.restaurant_phone,
                is_active=True,
                supports_dine_in=True,
                supports_takeaway=True,
                supports_delivery=True,
            )
        )
        application_user = User(
            id=user_id,
            restaurant_id=restaurant.id,
            email=user_email.lower(),
            name=payload.owner_name or payload.restaurant_name,
            role="owner",
            is_active=True,
        )
        db.add(application_user)
        db.commit()
    except IntegrityError:
        # A second submit raced the first one: return the workspace that was created.
        db.rollback()
        existing_user = db.get(User, user_id)
        if existing_user is None:
            raise
        return profile_response(db, existing_user)

    return profile_response(db, application_user)
