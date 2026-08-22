from pydantic import BaseModel


class ChatRequest(BaseModel):

    message: str

    restaurant_id: str

    branch_id: str


class ChatResponse(BaseModel):

    answer: str