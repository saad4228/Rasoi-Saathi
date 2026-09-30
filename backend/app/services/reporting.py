"""Business-day helpers: reports group orders by the restaurant's local date, not UTC."""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from app.config import get_settings


def business_tz() -> ZoneInfo:
    return ZoneInfo(get_settings().business_timezone)


def local_today() -> date:
    return datetime.now(business_tz()).date()


def day_start_utc(day: date) -> datetime:
    """UTC instant at which `day` begins in the business timezone."""
    return datetime.combine(day, time.min, tzinfo=business_tz()).astimezone(timezone.utc)


def local_date(moment: datetime) -> date:
    # SQLite (tests) returns naive datetimes; everything is stored as UTC.
    aware = moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)
    return aware.astimezone(business_tz()).date()
