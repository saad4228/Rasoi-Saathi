from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_authenticated_user_claims, get_current_user
from app.database import get_db
from app.models.restaurant import Restaurant
from app.models.user import User
from app.schemas.auth import AuthUserResponse, OnboardingRequest


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=AuthUserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/onboarding", response_model=AuthUserResponse)
def onboard_owner(
    payload: OnboardingRequest,
    claims: Annotated[dict[str, Any], Depends(get_authenticated_user_claims)],
    db: Session = Depends(get_db),
) -> User:
    try:
        user_id = UUID(claims["sub"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authenticated user") from exc

    with db.begin():
        existing_user = db.get(User, user_id)
        if existing_user is not None:
            return existing_user

        user_email = claims.get("email")
        if not isinstance(user_email, str) or not user_email:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authenticated email is unavailable")

        restaurant = Restaurant(
            name=payload.restaurant_name,
            email=payload.restaurant_email,
            phone=payload.restaurant_phone,
        )
        db.add(restaurant)
        db.flush()

        application_user = User(
            id=user_id,
            restaurant_id=restaurant.id,
            email=user_email,
            name=payload.restaurant_name,
            role="owner",
            is_active=True,
        )
        db.add(application_user)

    return application_user