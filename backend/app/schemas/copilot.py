from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class CopilotTurn(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(min_length=1, max_length=4_000)


class CopilotChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2_000)
    branch_id: UUID | None = None
    # Earlier turns of this conversation (oldest first) so follow-up questions keep context.
    history: list[CopilotTurn] = Field(default_factory=list, max_length=20)


class CopilotChatResponse(BaseModel):
    answer: str
    branch_id: UUID | None
