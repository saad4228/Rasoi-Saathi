from __future__ import annotations

import logging
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, Form, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.whatsapp_bot import process_whatsapp_message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])


@router.post("/webhook")
async def twilio_whatsapp_webhook(
    From: str = Form(...),
    Body: str = Form(...),
    ProfileName: str | None = Form(default=None),
    db: Session = Depends(get_db),
):
    """Incoming webhook from Twilio WhatsApp Sandbox."""
    phone = From.replace("whatsapp:", "").strip()
    logger.info("Incoming WhatsApp message from %s (%s): %s", phone, ProfileName, Body)

    reply_text = await process_whatsapp_message(
        db=db,
        phone=phone,
        sender_name=ProfileName or "Customer",
        message_text=Body,
    )

    safe_reply = escape(reply_text)
    twiml_response = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{safe_reply}</Message>
</Response>"""

    return Response(content=twiml_response, media_type="application/xml")


class SimulateWhatsAppRequest(BaseModel):
    phone: str = "+917866053115"
    sender_name: str = "Test Customer"
    message: str


@router.post("/simulate")
async def simulate_whatsapp_message(
    payload: SimulateWhatsAppRequest,
    db: Session = Depends(get_db),
):
    """Test endpoint to simulate incoming WhatsApp messages without needing Twilio live connection."""
    reply = await process_whatsapp_message(
        db=db,
        phone=payload.phone,
        sender_name=payload.sender_name,
        message_text=payload.message,
    )
    return {"reply": reply}
