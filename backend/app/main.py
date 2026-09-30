import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import get_settings
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

app = FastAPI(
    title="Rasoi Saathi API",
    version="1.0.0"
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
