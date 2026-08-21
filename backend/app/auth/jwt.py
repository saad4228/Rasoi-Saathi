from __future__ import annotations

from functools import lru_cache
from typing import Any

import httpx
import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient

from app.config import get_settings


@lru_cache
def get_jwks_client() -> PyJWKClient:
    return PyJWKClient(get_settings().jwks_url)


def validate_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()

    try:
        signing_key = get_jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience=settings.supabase_jwt_audience,
            issuer=settings.jwt_issuer,
            options={"require": ["sub", "exp", "aud", "iss"]},
        )
    except (httpx.HTTPError, jwt.PyJWTError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    return claims