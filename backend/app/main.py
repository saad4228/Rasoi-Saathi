import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.auth.jwt import get_jwks_client
from app.config import get_settings
from app.database import engine
from app.routers.auth import router as auth_router
from app.routers.copilot import router as copilot_router
from app.routers.demo import router as demo_router
from app.routers.operations import router as operations_router
from app.routers.whatsapp import router as whatsapp_router

logger = logging.getLogger(__name__)


class UnhandledErrorMiddleware:
    """Turn unhandled exceptions into JSON 500s *inside* the CORS middleware.

    Starlette routes `@app.exception_handler(Exception)` to ServerErrorMiddleware,
    which sits outside every user middleware, so those responses never receive
    CORS headers and browsers report a network failure instead of the error.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        response_started = False

        async def tracking_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, receive, tracking_send)
        except Exception:
            logger.exception("Unhandled exception on %s %s", scope.get("method"), scope.get("path"))
            if response_started:
                raise
            response = JSONResponse(
                status_code=500,
                content={"detail": "An unexpected server error occurred. Please try again."},
            )
            await response(scope, receive, send)


settings = get_settings()
allowed_origins = [origin.strip().rstrip("/") for origin in settings.frontend_url.split(",") if origin.strip()]
# Any local port is allowed: `next dev` silently moves to 3001, 3002, ... when 3000 is busy,
# and a blocked CORS request looks like a failed login in the browser.
LOCAL_DEV_ORIGINS = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"


def warm_up() -> None:
    """Pay the one-off costs of the first request at startup instead of making a visitor wait.

    Opening the first connection to a hosted Supabase region costs a couple of seconds (DNS,
    TLS, pooler auth), and the first token check downloads Supabase's signing keys. Whoever
    opened the login page first used to absorb both. Failures are only logged: the app must
    still start when the database or Supabase is unreachable, so the request path can report
    the real problem.
    """
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - startup must not depend on the database being up
        logger.warning("Could not open a database connection at startup (%s); the first request will.", exc)
    if not settings.supabase_jwt_secret:
        try:
            get_jwks_client().get_jwk_set()
        except Exception as exc:  # noqa: BLE001 - same: the request path reports this properly
            logger.warning("Could not fetch Supabase signing keys at startup (%s); the first login will.", exc)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # A daemon thread, so slow or unreachable services can't hold up startup or shutdown.
    # Skipped for SQLite (the tests), where there is nothing to warm up.
    if engine.dialect.name != "sqlite":
        threading.Thread(target=warm_up, name="warm-up", daemon=True).start()
    yield


app = FastAPI(
    title="Rasoi Saathi API",
    version="1.0.0",
    lifespan=lifespan,
)

# Middleware added last runs first: CORS must wrap the error middleware so
# error responses still carry CORS headers.
app.add_middleware(UnhandledErrorMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=LOCAL_DEV_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(copilot_router)
app.include_router(demo_router)
app.include_router(operations_router)
app.include_router(whatsapp_router)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "rasoi-saathi"
    }
