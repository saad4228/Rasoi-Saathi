import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers.auth import router as auth_router
from app.routers.copilot import router as copilot_router
from app.routers.operations import router as operations_router
from app.routers.whatsapp import router as whatsapp_router

logger = logging.getLogger(__name__)

settings = get_settings()
allowed_origins = list({
    settings.frontend_url,
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
})

app = FastAPI(
    title="Rasoi Saathi API",
    version="1.0.0"
)

# CORS must be added BEFORE the global exception handler so it wraps everything
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(copilot_router)
app.include_router(operations_router)
app.include_router(whatsapp_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler so every 500 gets a JSON body.
    Starlette's CORSMiddleware can only attach headers to proper ASGI responses;
    unhandled exceptions that bubble up as raw exceptions bypass it.
    By catching them here and returning a JSONResponse we guarantee CORS headers
    are always present on error responses."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. Please try again."},
    )


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "rasoi-saathi"
    }
