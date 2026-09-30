from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError

from app.config import get_settings

logger = logging.getLogger(__name__)

ASYMMETRIC_ALGORITHMS = ["RS256", "ES256"]
# Tolerated clock difference with Supabase. Without it, a PC whose clock runs a second or two
# behind rejects every brand-new token as "not yet valid" and login fails right after sign-in.
CLOCK_SKEW_SECONDS = 60


@lru_cache
def get_jwks_client() -> PyJWKClient:
    return PyJWKClient(get_settings().jwks_url, timeout=10)


def _invalid_token() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _signing_key(token: str, algorithm: str | None) -> tuple[Any, list[str]]:
    settings = get_settings()
    if algorithm == "HS256":
        if not settings.supabase_jwt_secret:
            logger.error(
                "Received an HS256 Supabase token but SUPABASE_JWT_SECRET is not configured. "
                "Copy the JWT secret from Supabase (Project Settings -> API -> JWT Settings) into backend/.env."
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="The server cannot verify logins yet: SUPABASE_JWT_SECRET is not configured.",
            )
        return settings.supabase_jwt_secret, ["HS256"]
    return get_jwks_client().get_signing_key_from_jwt(token).key, ASYMMETRIC_ALGORITHMS


def validate_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()

    try:
        algorithm = jwt.get_unverified_header(token).get("alg")
        key, algorithms = _signing_key(token, algorithm)
        return jwt.decode(
            token,
            key,
            algorithms=algorithms,
            audience=settings.supabase_jwt_audience,
            issuer=settings.jwt_issuer,
            options={"require": ["sub", "exp", "aud", "iss"]},
            leeway=CLOCK_SKEW_SECONDS,
        )
    except PyJWKClientConnectionError as exc:
        logger.error("Could not fetch Supabase signing keys from %s: %s", settings.jwks_url, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The server could not reach Supabase to verify your login. Check SUPABASE_URL and that the project is active.",
        ) from exc
    except (jwt.PyJWTError, ValueError) as exc:
        logger.warning("Rejected a login token: %s", exc)
        raise _invalid_token() from exc
