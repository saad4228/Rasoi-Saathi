from uuid import UUID

from pydantic import BaseModel, Field


class CopilotChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2_000)
    branch_id: UUID | None = None


class CopilotChatResponse(BaseModel):
    answer: str
    branch_id: UUID | None
