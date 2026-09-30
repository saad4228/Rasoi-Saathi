import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.config import get_settings
from app.database import get_db
from app.models.branch import Branch
from app.models.user import User
from app.schemas.copilot import CopilotChatRequest, CopilotChatResponse
from app.services.copilot import CopilotService, CopilotUnavailableError, GeminiCopilot

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/copilot", tags=["copilot"])


def verified_branch(db: Session, restaurant_id: UUID, branch_id: UUID | None) -> UUID | None:
    if branch_id is None:
        return None
    result = db.scalar(
        select(Branch.id).where(
            Branch.id == branch_id,
            Branch.restaurant_id == restaurant_id,
        )
    )
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outlet not found")
    return result


@router.post("/chat", response_model=CopilotChatResponse)
def chat(
    payload: CopilotChatRequest,
    user: User = Depends(require_roles("owner")),
    db: Session = Depends(get_db),
) -> CopilotChatResponse:
    branch_id = verified_branch(db, user.restaurant_id, payload.branch_id)
    settings = get_settings()
    service = CopilotService(db=db, restaurant_id=user.restaurant_id, branch_id=branch_id)
    copilot = GeminiCopilot(service=service, api_key=settings.gemini_api_key, model=settings.gemini_model)
    try:
        answer = copilot.answer(payload.message, [(turn.role, turn.text) for turn in payload.history])
    except CopilotUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected copilot error")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI Copilot encountered an unexpected error. Please try again shortly.",
        ) from exc
    return CopilotChatResponse(answer=answer, branch_id=branch_id)

