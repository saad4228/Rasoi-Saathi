from __future__ import annotations

from collections.abc import Callable
from typing import Annotated, Any
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.jwt import validate_access_token
from app.database import get_db
from app.models.user import User


bearer_scheme = HTTPBearer(auto_error=False)
SUPPORTED_ROLES = frozenset({"owner", "chef", "waiter"})


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    user_id = get_authenticated_user_id(credentials)

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None or not user.is_active:
        raise _unauthorized("Application user is not active")

    return user


def get_authenticated_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> UUID:
    claims = get_authenticated_user_claims(credentials)
    return UUID(claims["sub"])


def get_authenticated_user_claims(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized("Bearer authentication is required")

    claims = validate_access_token(credentials.credentials)
    try:
        UUID(claims["sub"])
    except (KeyError, TypeError, ValueError) as exc:
        raise _unauthorized("Authentication token has no valid user ID") from exc

    return claims


def require_roles(*roles: str) -> Callable[..., User]:
    requested_roles = frozenset(roles)
    unsupported_roles = requested_roles - SUPPORTED_ROLES
    if not requested_roles or unsupported_roles:
        raise ValueError("require_roles accepts only owner, chef, and waiter")

    def role_dependency(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in requested_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role permissions",
            )
        return current_user

    return role_dependency