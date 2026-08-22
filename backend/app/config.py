from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
	supabase_url: str = Field(min_length=1)
	supabase_jwt_audience: str = "authenticated"
	supabase_jwt_issuer: str | None = None
	frontend_url: str = "http://localhost:3000"
	gemini_api_key: str | None = None
	gemini_model: str = "gemini-3.5-flash-lite"

	# Twilio WhatsApp Configuration
	twilio_account_sid: str | None = None
	twilio_auth_token: str | None = None
	twilio_whatsapp_number: str = "whatsapp:+17372508034"

	model_config = SettingsConfigDict(
		env_file=".env",
		env_file_encoding="utf-8",
		extra="ignore",
	)

	@property
	def jwt_issuer(self) -> str:
		return self.supabase_jwt_issuer or f"{self.supabase_url.rstrip('/')}/auth/v1"

	@property
	def jwks_url(self) -> str:
		return f"{self.jwt_issuer}/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
	return Settings()


settings = Settings()
