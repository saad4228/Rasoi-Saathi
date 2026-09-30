from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve backend/.env from this file's location so the app works no matter
# which directory uvicorn/alembic/pytest is started from.
BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
	supabase_url: str = Field(min_length=1)
	supabase_jwt_audience: str = "authenticated"
	supabase_jwt_issuer: str | None = None
	# Legacy Supabase projects sign access tokens with a shared HS256 secret
	# (Project Settings -> API -> JWT Settings). Projects using asymmetric
	# signing keys are verified through the public JWKS endpoint instead.
	supabase_jwt_secret: str | None = None
	frontend_url: str = "http://localhost:3000"
	gemini_api_key: str | None = None
	gemini_model: str = "gemini-3.5-flash-lite"

	# Password of the public demo logins (shown on the login page). To change it: delete the three
	# *@rasoisaathi-demo.app users in Supabase -> Authentication -> Users, then re-run seed_demo.py.
	demo_password: str = Field(default="SaffronDemo@2026", min_length=8)

	# Reporting
	business_timezone: str = "Asia/Kolkata"
	aggregator_commission_percent: float = Field(default=20.0, ge=0, le=100)

	# Twilio WhatsApp Configuration
	twilio_account_sid: str | None = None
	twilio_auth_token: str | None = None
	twilio_whatsapp_number: str = "whatsapp:+17372508034"
	# Public URL Twilio posts to. Only needed when a proxy rewrites the host or
	# scheme so the signature cannot be validated against the request URL.
	twilio_webhook_url: str | None = None
	twilio_validate_signature: bool = True

	model_config = SettingsConfigDict(
		env_file=ENV_FILE,
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
