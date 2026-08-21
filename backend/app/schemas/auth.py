from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AuthUserResponse(BaseModel):
    id: UUID
    email: str
    name: str
    role: str
    restaurant_id: UUID

    model_config = ConfigDict(from_attributes=True)


class OnboardingRequest(BaseModel):
    restaurant_name: str = Field(min_length=1, max_length=150)
    restaurant_email: str | None = Field(default=None, max_length=255)
    restaurant_phone: str | None = Field(default=None, max_length=20)