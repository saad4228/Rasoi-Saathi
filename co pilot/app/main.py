from fastapi import FastAPI, Depends

from sqlalchemy.orm import Session

from app.database import get_db

from app.schemas import (
    ChatRequest,
    ChatResponse
)

from app.ai.agent import run_agent


app = FastAPI(
    title="Rasoi Sathi AI API",
    version="1.0.0"
)


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():

    return {
        "message":
            "Rasoi Sathi AI API is running"
    }


# =========================================================
# HEALTH
# =========================================================

@app.get("/health")
def health():

    return {
        "status":
            "healthy"
    }


# =========================================================
# AI CHAT
# =========================================================

@app.post(
    "/chat",
    response_model=ChatResponse
)
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db)
):

    answer = run_agent(

        db,

        request.message,

        request.restaurant_id,

        request.branch_id
    )

    return {

        "answer":
            answer
    }