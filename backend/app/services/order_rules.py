"""Order lifecycle rules shared by the orders API and its tests."""

from __future__ import annotations

ORDER_STATUSES = ("PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED")
ORDER_TYPES = ("DINE_IN", "TAKEAWAY", "DELIVERY")
TERMINAL_STATUSES = frozenset({"COMPLETED", "CANCELLED"})

# Which status an order may move to from its current status.
ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    "PENDING": frozenset({"CONFIRMED", "PREPARING", "READY", "CANCELLED"}),
    "CONFIRMED": frozenset({"PREPARING", "READY", "CANCELLED"}),
    "PREPARING": frozenset({"READY", "CANCELLED"}),
    # READY -> PREPARING lets the kitchen correct a mistaken tap; stock is only deducted once.
    "READY": frozenset({"PREPARING", "COMPLETED", "CANCELLED"}),
    "COMPLETED": frozenset(),
    "CANCELLED": frozenset(),
}

# Which roles may move an order *into* a status.
ROLES_FOR_STATUS: dict[str, frozenset[str]] = {
    "CONFIRMED": frozenset({"owner", "chef"}),
    "PREPARING": frozenset({"owner", "chef"}),
    "READY": frozenset({"owner", "chef"}),
    "COMPLETED": frozenset({"owner", "waiter"}),
    "CANCELLED": frozenset({"owner", "chef"}),
}


def transition_error(current: str, target: str, role: str) -> tuple[int, str] | None:
    """Return (http_status, message) when the change is not allowed, else None."""
    if target not in ALLOWED_TRANSITIONS.get(current, frozenset()):
        return 409, f"An order cannot move from {current} to {target}."
    if role not in ROLES_FOR_STATUS.get(target, frozenset()):
        return 403, f"Your role cannot mark an order {target}."
    return None
