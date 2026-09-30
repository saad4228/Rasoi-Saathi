from __future__ import annotations

import logging
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from twilio.request_validator import RequestValidator

from app.auth.dependencies import require_roles
from app.config import get_settings
from app.database import get_db
from app.demo import forbid_in_demo
from app.models.user import User
from app.services.whatsapp_bot import process_whatsapp_message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])


def _candidate_urls(request: Request, configured_url: str | None) -> list[str]:
    """URLs Twilio may have signed: the configured public URL, or the request URL as seen through a proxy."""
    candidates = [configured_url] if configured_url else []
    candidates.append(str(request.url))
    forwarded_proto = request.headers.get("x-forwarded-proto")
    forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if forwarded_proto or forwarded_host:
        candidates.append(str(request.url.replace(scheme=forwarded_proto or request.url.scheme, netloc=forwarded_host or request.url.netloc)))
    return list(dict.fromkeys(candidates))


async def verified_twilio_form(request: Request) -> dict[str, str]:
    """Parse Twilio's form post and reject it unless the X-Twilio-Signature matches."""
    form = {key: str(value) for key, value in (await request.form()).items()}
    settings = get_settings()
    if not settings.twilio_validate_signature:
        return form
    if not settings.twilio_auth_token:
        logger.error("Rejecting WhatsApp webhook: TWILIO_AUTH_TOKEN is not set, so the request cannot be verified.")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="WhatsApp webhook is not configured")

    validator = RequestValidator(settings.twilio_auth_token)
    signature = request.headers.get("x-twilio-signature", "")
    if not any(validator.validate(url, form, signature) for url in _candidate_urls(request, settings.twilio_webhook_url)):
        logger.warning(
            "Rejected WhatsApp webhook with an invalid Twilio signature. If this is a real Twilio request behind a "
            "tunnel or proxy, set TWILIO_WEBHOOK_URL to the exact URL configured in the Twilio console."
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Twilio signature")
    return form


# Plain `def` routes run in FastAPI's threadpool, so the blocking database and
# Gemini calls inside the bot can't stall the event loop for every other request.
@router.post("/webhook")
def twilio_whatsapp_webhook(
    form: dict[str, str] = Depends(verified_twilio_form),
    db: Session = Depends(get_db),
):
    """Incoming webhook from Twilio WhatsApp."""
    sender = form.get("From", "")
    body = form.get("Body", "")
    if not sender:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing sender")
    phone = sender.replace("whatsapp:", "").strip()
    logger.info("Incoming WhatsApp message from %s", phone)

    reply_text = process_whatsapp_message(
        db=db,
        phone=phone,
        sender_name=form.get("ProfileName") or "Customer",
        message_text=body,
    )

    twiml_response = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{escape(reply_text)}</Message>
</Response>"""

    return Response(content=twiml_response, media_type="application/xml")


class SimulateWhatsAppRequest(BaseModel):
    phone: str = Field(default="+910000000000", max_length=20)
    sender_name: str = Field(default="Test Customer", max_length=150)
    message: str = Field(min_length=1, max_length=1000)


@router.post("/simulate")
def simulate_whatsapp_message(
    payload: SimulateWhatsAppRequest,
    user: User = Depends(require_roles("owner")),
    db: Session = Depends(get_db),
):
    """Owner-only test hook: runs the bot against the owner's own restaurant without Twilio."""
    forbid_in_demo(user.restaurant_id, "The WhatsApp simulator")
    reply = process_whatsapp_message(
        db=db,
        phone=payload.phone,
        sender_name=payload.sender_name,
        message_text=payload.message,
        restaurant_id=user.restaurant_id,
    )
    return {"reply": reply}
